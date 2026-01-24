import type { ParcelLookupRequest, ResultsResponse, ResultRow } from "@dsd/shared";
import { performance } from "node:perf_hooks";

import { lookupParcel } from "./parcelService.js";
import { buildResultsRows } from "./rows/buildResultsRows.js";

import { GEOMETRY_SERVER, OVERLAYS } from "./overlays/overlayRegistry.js";
import { bufferPolygon, queryLayerByGeometry } from "./overlays/arcgisRest.js";

import { zoningRowsFromAttributes } from "./overlays/zoning.js";
import { currentFloodRowsFromFeatures, pre2008FloodRowsFromFeatures } from "./overlays/flood.js";

import { communityBasePlanningAreaRowsFromFeatures } from "./overlays/communityBasePlanningArea.js";
import { countyWidePlanningAreaRowsFromFeatures } from "./overlays/countyWidePlanningArea.js";
import { plannedDevelopmentRowsFromFeatures } from "./overlays/plannedDevelopment.js";
import { futureLanduseRowsFromFeatures } from "./overlays/futureLanduse.js";
import { urbanServiceAreaRowsFromFeatures } from "./overlays/urbanServiceArea.js";
import { censusDataRowsFromFeatures } from "./overlays/censusData.js";
import { tazRowsFromFeatures } from "./overlays/taz.js";
import { impactFeeRowsFromFeatures } from "./overlays/impactFees.js";
import { simpleInfoLayerRowsFromFeatures } from "./overlays/infoLayers.js";
import {
  mobilityAssessmentRowsFromFeatures,
  mobilityBenefitRowsFromFeatures,
} from "./overlays/mobility.js";
import { hcaaLayerRowsFromFeatures, hcaaNameRowsFromFeatures } from "./overlays/hcaa.js";
import { extrasRowsFromFeatures, serviceAreaRowsFromFeatures } from "./overlays/extras.js";

type OverlayResult = { title?: string; rows: ResultRow[] };

export async function getResultsForParcelLookup(
  req: ParcelLookupRequest
): Promise<ResultsResponse> {
  const parcel = await lookupParcel(req);

  // --- Site Info ------------------------------------------------------------
  const siteInfo = await buildResultsRows(parcel);

  const sections: Record<string, ResultRow[]> = {
    SiteInfo: siteInfo,
  };

  // No polygon => can’t buffer/query overlays
  if (!parcel.geometry?.rings?.length) {
    return { parcel, rows: [], sections };
  }

  const wkid =
    parcel.geometry.spatialReference?.wkid ??
    parcel.geometry.spatialReference?.latestWkid ??
    102100;

  // Legacy: if acreage > 0 => -1 ft, else +1 ft (unit 9003)
  const acreage = Number(parcel.attributes?.ACREAGE ?? 0);
  const distanceFeet = acreage > 0 ? -1 : 1;

  const buffered = await bufferPolygon({
    geometryServerUrl: GEOMETRY_SERVER,
    polygon: parcel.geometry,
    distanceFeet,
    wkid,
    unit: 9003,
  });

  const flatRows: ResultRow[] = [];

  // --- Optional overlay timing diagnostics ---------------------------------
  const ENABLE_OVERLAY_TIMINGS =
    process.env.OVERLAY_TIMINGS === "1" || process.env.OVERLAY_TIMINGS === "true";

  const timingRows: Array<{
    key: string;
    title?: string;
    ms: number;
    rowCount: number;
  }> = [];

  const requestT0 = ENABLE_OVERLAY_TIMINGS ? performance.now() : 0;


  // Pure overlay runner: returns rows, does NOT mutate sections/flatRows.
  const runOverlay = async (
    key: string,
    handler: (features: any[]) => ResultRow[]
  ): Promise<OverlayResult> => {
    const def = OVERLAYS.find((o) => o.key === key);
    if (!def) return { title: undefined, rows: [] };

    const resp = await queryLayerByGeometry({
      layerUrl: def.url,
      geometry: buffered,
      wkid,
      outFields: def.outFields,
      returnGeometry: false,
    });

    const features = resp?.features ?? [];
    const rows = handler(features) ?? [];
    return { title: def.title, rows };
  };

  // Concurrency-limited runner that preserves declared order
  const runInPool = async <T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number
  ): Promise<Array<T | undefined>> => {
    const results: Array<T | undefined> = new Array(tasks.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= tasks.length) break;

        // Important: never let a worker crash the whole pool
        try {
          results[i] = await tasks[i]();
        } catch {
          results[i] = undefined;
        }
      }
    });

    await Promise.all(workers);
    return results;
  };

  // --- Overlay task list (order here == legacy order output) ----------------
  const overlayTasks: Array<{ key: string; run: () => Promise<OverlayResult> }> = [
    // --- Zoning -------------------------------------------------------------
    {
      key: "zoning",
      run: () =>
        runOverlay("zoning", (features) =>
          (features ?? []).flatMap((f: any) =>
            zoningRowsFromAttributes(f?.attributes ?? {})
          )
        ),
    },

    // --- Flood (Current Effective) -----------------------------------------
    { key: "flood", run: () => runOverlay("flood", (features) => currentFloodRowsFromFeatures(features)) },

    // --- Flood (Pre 2008) ---------------------------------------------------
    { key: "oldFlood", run: () => runOverlay("oldFlood", (features) => pre2008FloodRowsFromFeatures(features)) },

    // --- Planning / Land Use ------------------------------------------------
    {
      key: "communityBasePlanningArea",
      run: () =>
        runOverlay("communityBasePlanningArea", (features) =>
          communityBasePlanningAreaRowsFromFeatures(features)
        ),
    },
    {
      key: "countyWidePlanningArea",
      run: () =>
        runOverlay("countyWidePlanningArea", (features) =>
          countyWidePlanningAreaRowsFromFeatures(features)
        ),
    },
    {
      key: "plannedDevelopment",
      run: () =>
        runOverlay("plannedDevelopment", (features) =>
          plannedDevelopmentRowsFromFeatures(features)
        ),
    },
    { key: "futureLanduse", run: () => runOverlay("futureLanduse", (features) => futureLanduseRowsFromFeatures(features)) },
    { key: "urbanServiceArea", run: () => runOverlay("urbanServiceArea", (features) => urbanServiceAreaRowsFromFeatures(features)) },
    { key: "censusData", run: () => runOverlay("censusData", (features) => censusDataRowsFromFeatures(features)) },
    { key: "taz", run: () => runOverlay("taz", (features) => tazRowsFromFeatures(features)) },

    // --- Impact Fees --------------------------------------------------------
    {
      key: "fireFee",
      run: () =>
        runOverlay("fireFee", (features) =>
          impactFeeRowsFromFeatures("Fire Impact Fee", features)
        ),
    },
    {
      key: "parksFee",
      run: () =>
        runOverlay("parksFee", (features) =>
          impactFeeRowsFromFeatures("Parks Impact Fee", features)
        ),
    },
    {
      key: "transFee",
      run: () =>
        runOverlay("transFee", (features) =>
          impactFeeRowsFromFeatures("Transportation Impact Fee", features)
        ),
    },

    // --- InfoLayers (Wind / Overlay / FIRM Panel) ---------------------------
    {
      key: "windCat1",
      run: () =>
        runOverlay("windCat1", (features) =>
          simpleInfoLayerRowsFromFeatures("Wind Borne Debris Category 1", features)
        ),
    },
    {
      key: "windCat2",
      run: () =>
        runOverlay("windCat2", (features) =>
          simpleInfoLayerRowsFromFeatures("Wind Borne Debris Category 2", features)
        ),
    },
    {
      key: "windCat3",
      run: () =>
        runOverlay("windCat3", (features) =>
          simpleInfoLayerRowsFromFeatures("Wind Borne Debris Category 3", features)
        ),
    },
    {
      key: "windCat4",
      run: () =>
        runOverlay("windCat4", (features) =>
          simpleInfoLayerRowsFromFeatures("Wind Borne Debris Category 4", features)
        ),
    },
    {
      key: "overlayArea",
      run: () =>
        runOverlay("overlayArea", (features) =>
          simpleInfoLayerRowsFromFeatures("Overlay Area", features)
        ),
    },
    {
      key: "firm",
      run: () =>
        runOverlay("firm", (features) =>
          simpleInfoLayerRowsFromFeatures("FIRM Panel", features)
        ),
    },

    // --- Mobility Fees ------------------------------------------------------
    { key: "mobilityAssess", run: () => runOverlay("mobilityAssess", (features) => mobilityAssessmentRowsFromFeatures(features)) },
    { key: "mobilityBenefit", run: () => runOverlay("mobilityBenefit", (features) => mobilityBenefitRowsFromFeatures(features)) },

    // --- HCAA ----------------------------------------------------------------
    { key: "hcaaTea", run: () => runOverlay("hcaaTea", (features) => hcaaLayerRowsFromFeatures("HCAA TEA", features)) },
    { key: "hcaaLf", run: () => runOverlay("hcaaLf", (features) => hcaaLayerRowsFromFeatures("HCAA Landfill", features)) },
    { key: "hcaaSchool", run: () => runOverlay("hcaaSchool", (features) => hcaaLayerRowsFromFeatures("HCAA School", features)) },
    { key: "hcaaA", run: () => runOverlay("hcaaA", (features) => hcaaNameRowsFromFeatures("HCAA A", features)) },

    // --- City of Tampa Service Areas ----------------------------------------
    { key: "cotWater", run: () => runOverlay("cotWater", (features) => serviceAreaRowsFromFeatures("City of Tampa Water", features)) },
    {
      key: "cotWastewater",
      run: () =>
        runOverlay("cotWastewater", (features) =>
          serviceAreaRowsFromFeatures("City of Tampa Wastewater", features)
        ),
    },

    // --- Regulatory / Economic Extras ---------------------------------------
    { key: "competitiveSites", run: () => runOverlay("competitiveSites", (features) => extrasRowsFromFeatures("Competitive Sites", features)) },
    {
      key: "redevelopmentAreas",
      run: () =>
        runOverlay("redevelopmentAreas", (features) =>
          extrasRowsFromFeatures("Redevelopment Areas", features)
        ),
    },
    {
      key: "historicalResources",
      run: () =>
        runOverlay("historicalResources", (features) =>
          extrasRowsFromFeatures("Historical Resources", features)
        ),
    },
  ];

  // NOTE: Pick a sane default; can be made env-configurable later.
  const OVERLAY_CONCURRENCY = 8;

  // Wrap tasks so a single overlay can fail without breaking the whole request.
  // Also record overlay timings when enabled.
  const safeTasks = overlayTasks.map(({ key, run }) => async (): Promise<OverlayResult> => {
    const t0 = ENABLE_OVERLAY_TIMINGS ? performance.now() : 0;

    try {
      const result = await run();

      if (ENABLE_OVERLAY_TIMINGS) {
        timingRows.push({
          key,
          title: result.title,
          ms: performance.now() - t0,
          rowCount: result.rows?.length ?? 0,
        });
      }

      return result;
    } catch {
      if (ENABLE_OVERLAY_TIMINGS) {
        timingRows.push({
          key,
          title: undefined,
          ms: performance.now() - t0,
          rowCount: 0,
        });
      }
      return { title: undefined, rows: [] };
    }
  });

  const overlaysT0 = ENABLE_OVERLAY_TIMINGS ? performance.now() : 0;
  const overlayResults = await runInPool(safeTasks, OVERLAY_CONCURRENCY);
  if (ENABLE_OVERLAY_TIMINGS) {
    console.log("[results] overlays wall ms", Math.round(performance.now() - overlaysT0));
  }

  // Merge results in declared order (legacy order preserved)
  for (const result of overlayResults) {
    if (!result) continue;

    const { title, rows } = result;
    if (title && rows.length) {
      sections[title] = rows;
      flatRows.push(...rows);
    }
  }

  // Log timings (does not affect response)
  if (ENABLE_OVERLAY_TIMINGS) {
    const totalMs = timingRows.reduce((sum, r) => sum + r.ms, 0);

    const top = [...timingRows]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 10)
      .map((r) => ({
        key: r.key,
        title: r.title ?? "(no title)",
        ms: Math.round(r.ms),
        rows: r.rowCount,
      }));

    console.log("[results] overlay timings", {
      overlays: timingRows.length,
      sumMs: Math.round(totalMs),
      top,
    });
  }

  if (ENABLE_OVERLAY_TIMINGS) {
    console.log("[results] request wall ms", Math.round(performance.now() - requestT0));
  }

  return {
    parcel,
    rows: flatRows,
    sections,
  };
}
