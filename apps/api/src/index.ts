// apps/api/src/index.ts

import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";

import { getResultsForParcelLookup } from "./services/resultsAggregator";
import { arcgisPostJson } from "./services/arcgisRest";
import {
  generateQueryPlan,
  getAvailableLayers,
  checkOllamaHealth
} from "./services/ollamaService";
import { executeQueryPlan, getRoute } from "./services/aiQueryExecutor";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT ?? 8787);

// Minimal health endpoint
app.get("/health", (_req, res) => res.json({ ok: true }));

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function geocoderBaseUrl() {
  // Set this in your env:
  // HC_COMPOSITE_URL=https://maps.hillsboroughcounty.org/arcgis/rest/services/Geocoding/Composite_Address_Locator_Overall/GeocodeServer
  return requireEnv("HC_COMPOSITE_URL").replace(/\/+$/, "");
}

type SuggestionOut = { text: string; magicKey?: string; isCollection?: boolean };

async function geocodeSuggest(q: string): Promise<SuggestionOut[]> {
  const url = new URL(geocoderBaseUrl() + "/suggest");
  url.searchParams.set("f", "json");
  url.searchParams.set("text", q);
  url.searchParams.set("maxSuggestions", "8");

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Suggest failed: ${r.status} ${r.statusText}`);
  const json: any = await r.json();

  return (json.suggestions ?? []).map((s: any) => ({
    text: s.text,
    magicKey: s.magicKey,
    isCollection: !!s.isCollection,
  }));
}

async function geocodeResolve(args: { text: string; magicKey?: string }) {
  const url = new URL(geocoderBaseUrl() + "/findAddressCandidates");
  url.searchParams.set("f", "json");
  url.searchParams.set("SingleLine", args.text);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("maxLocations", "1");
  url.searchParams.set("outSR", "102100"); // keep consistent with your current pipeline

  if (args.magicKey) url.searchParams.set("magicKey", args.magicKey);

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`Resolve failed: ${r.status} ${r.statusText}`);
  const json: any = await r.json();

  const c = json.candidates?.[0];
  if (!c?.location) {
    const msg = "No match found for that search.";
    const err = new Error(msg);
    (err as any).code = "NOT_FOUND";
    throw err;
  }

  return {
    matchedAddress: c.address as string,
    score: c.score ?? null,
    location: c.location as { x: number; y: number },
    attributes: c.attributes ?? null,
  };
}

// Autocomplete endpoint (mobile-friendly)
app.get("/api/geocode/suggest", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 3) return res.json({ suggestions: [] });

    const suggestions = await geocodeSuggest(q);
    return res.json({ suggestions });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Suggest error" });
  }
});

// Resolve endpoint (useful for debugging; UI can call results directly)
app.get("/api/geocode/resolve", async (req, res) => {
  try {
    const text = String(req.query.text ?? "").trim();
    const magicKey = String(req.query.magicKey ?? "").trim() || undefined;
    if (!text) return res.status(400).json({ error: "Missing text" });

    const resolved = await geocodeResolve({ text, magicKey });
    return res.json(resolved);
  } catch (err: any) {
    const msg = err?.message ?? "Resolve error";
    if ((err as any).code === "NOT_FOUND") return res.status(404).json({ error: msg });
    return res.status(500).json({ error: msg });
  }
});

// Address geocoding endpoint (POST for consistency with other endpoints)
app.post("/api/geocode/address", async (req, res) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== "string" || address.trim().length < 3) {
      return res.status(400).json({ error: "Address is required (min 3 characters)" });
    }

    const resolved = await geocodeResolve({ text: address.trim() });
    return res.json({
      candidates: [{
        address: resolved.matchedAddress,
        score: resolved.score,
        location: resolved.location,
        attributes: resolved.attributes
      }]
    });
  } catch (err: any) {
    const msg = err?.message ?? "Geocode error";
    if ((err as any).code === "NOT_FOUND") {
      return res.json({ candidates: [] });
    }
    return res.status(500).json({ error: msg });
  }
});

// Evacuation zone identification endpoint
// Using HEAT 2026 webmap layer - zone field is lowercase "zone", values are A, B, C, D, E
const EVACUATION_ZONE_LAYER_URL = "https://services.arcgis.com/apTfC6SUmnNfnxuF/arcgis/rest/services/HEAT_2026_Webmap/FeatureServer/1";

app.post("/api/identify/zone", async (req, res) => {
  try {
    const { x, y, spatialReference = 102100 } = req.body;

    if (typeof x !== "number" || typeof y !== "number") {
      return res.status(400).json({ error: "x and y coordinates are required" });
    }

    // Query using point geometry - the layer will handle the spatial relationship
    const geometry = {
      x: x,
      y: y,
      spatialReference: { wkid: spatialReference }
    };

    const queryUrl = new URL(`${EVACUATION_ZONE_LAYER_URL}/query`);
    const params = new URLSearchParams({
      f: "json",
      where: "1=1",
      geometry: JSON.stringify(geometry),
      geometryType: "esriGeometryPoint",
      spatialRel: "esriSpatialRelIntersects",
      inSR: String(spatialReference),
      outFields: "zone,EvacOrder",
      returnGeometry: "false"
    });

    const queryResp = await fetch(queryUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    if (!queryResp.ok) {
      throw new Error(`Zone query failed: ${queryResp.status}`);
    }

    const queryJson = await queryResp.json() as {
      features?: Array<{ attributes: Record<string, any> }>;
      error?: { message: string };
    };

    if (queryJson.error) {
      throw new Error(queryJson.error.message);
    }

    // Check if we found a zone
    if (!queryJson.features || queryJson.features.length === 0) {
      return res.json({
        zone: null,
        status: null,
        message: "Location is not in an evacuation zone"
      });
    }

    const feature = queryJson.features[0];
    const attributes = feature.attributes;

    // Extract zone information - the field is lowercase "zone" with values A, B, C, D, E
    const zone = attributes.zone;

    // Check for evacuation status from the EvacOrder field
    // EvacOrder field contains "Yes" or "No" indicating if an evacuation order is active
    const evacOrderValue = attributes.EvacOrder;
    const status = evacOrderValue === "Yes" ? "mandatory" : null;

    return res.json({
      zone: zone,
      status: status,
      orderActive: evacOrderValue === "Yes",
      attributes: attributes
    });
  } catch (err: any) {
    console.error("Zone identification error:", err);
    return res.status(500).json({ error: err?.message ?? "Zone identification failed" });
  }
});

const ParcelLookupSchema = z.union([
  z.object({
    type: z.literal("point"),
    point: z.object({
      x: z.number(),
      y: z.number(),
      spatialReference: z
        .object({
          wkid: z.number().optional(),
          latestWkid: z.number().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    type: z.literal("folio"),
    folio: z.string().min(1),
  }),
  // NEW: composite locator lookup (folios OR addresses), supports magicKey from suggest
  z.object({
    type: z.literal("locator"),
    text: z.string().min(1),
    magicKey: z.string().optional(),
  }),
]);

app.post("/api/results", async (req, res) => {
  const parsed = ParcelLookupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const lookup = parsed.data;

    // If user searched via locator text, resolve to a point, then reuse the existing point pipeline.
    if (lookup.type === "locator") {
      const resolved = await geocodeResolve({ text: lookup.text, magicKey: lookup.magicKey });

      const pointLookup = {
        type: "point" as const,
        point: {
          x: resolved.location.x,
          y: resolved.location.y,
          spatialReference: { wkid: 102100 },
        },
      };

      const results = await getResultsForParcelLookup(pointLookup);
      return res.json(results);
    }

    // Existing behavior (folio/point)
    const results = await getResultsForParcelLookup(lookup);
    return res.json(results);
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";

    // Treat "not found" as an expected user outcome
    if (/not found|no parcel|no features|no match/i.test(msg)) {
      return res.status(404).json({ error: msg });
    }

    return res.status(500).json({ error: msg });
  }
});

// Query parcels by geometry endpoint (used by Address List feature)
app.post("/api/overlays/query-parcels", async (req, res) => {
  try {
    const { geometry } = req.body;

    console.log("Received query-parcels request");
    console.log("Geometry WKID:", geometry?.spatialReference?.wkid);
    console.log("Rings count:", geometry?.rings?.length);

    if (!geometry?.rings || !geometry?.spatialReference?.wkid) {
      return res.status(400).json({ error: "Invalid geometry: must include rings and spatialReference.wkid" });
    }

    // Use the same parcels layer as parcelService
    const parcelsLayerUrl = "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/MapServer/0/query";

    // Use POST request to handle large geometry payloads (buffer coordinates)
    const result = await arcgisPostJson<{ features: Array<{ attributes: Record<string, any>; geometry?: any }> }>(parcelsLayerUrl, {
      where: "1=1",
      geometry: JSON.stringify({
        rings: geometry.rings,
        spatialReference: { wkid: geometry.spatialReference.wkid }
      }),
      geometryType: "esriGeometryPolygon",
      spatialRel: "esriSpatialRelIntersects",
      inSR: geometry.spatialReference.wkid,
      outFields: "*",
      returnGeometry: true,
      outSR: geometry.spatialReference.wkid
    });

    console.log("Query successful, feature count:", result.features.length);
    return res.json({ features: result.features });
  } catch (err: any) {
    console.error("Query parcels error:", err);
    console.error("Error message:", err?.message);
    const msg = err?.message ?? "Query parcels error";
    return res.status(500).json({ error: msg });
  }
});

// AI Query endpoints
// Health check for Ollama service
app.get("/api/ai/health", async (_req, res) => {
  try {
    const healthy = await checkOllamaHealth();
    return res.json({
      ok: healthy,
      message: healthy ? "Ollama is running" : "Ollama is not available"
    });
  } catch (err: any) {
    return res.json({ ok: false, message: err?.message ?? "Health check failed" });
  }
});

// Get available layers for AI queries
app.get("/api/ai/layers", (_req, res) => {
  const layers = getAvailableLayers();
  return res.json({ layers });
});

// Execute AI-powered spatial query
const AiQuerySchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters")
});

app.post("/api/ai/query", async (req, res) => {
  const parsed = AiQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { question } = parsed.data;

  try {
    // Check if Ollama is available
    const ollamaHealthy = await checkOllamaHealth();
    if (!ollamaHealthy) {
      return res.status(503).json({
        error: "AI service unavailable. Please ensure Ollama is running."
      });
    }

    // Generate query plan from natural language
    console.log("Generating query plan for:", question);
    const plan = await generateQueryPlan(question);

    // Check if LLM returned an error
    if ("error" in plan) {
      return res.status(400).json({
        success: false,
        question,
        error: plan.error,
        suggestion: plan.suggestion
      });
    }

    console.log("Query plan generated:", JSON.stringify(plan, null, 2));

    // Execute the query plan
    const result = await executeQueryPlan(question, plan);

    return res.json(result);
  } catch (err: any) {
    console.error("AI query error:", err);
    return res.status(500).json({
      success: false,
      question,
      error: err?.message ?? "Query execution failed"
    });
  }
});

// Direct directions endpoint - uses destination coordinates instead of geocoding
const DirectionsSchema = z.object({
  originAddress: z.string().min(3, "Origin address is required"),
  destinationName: z.string(),
  destinationCoords: z.object({
    x: z.number(),
    y: z.number()
  })
});

app.post("/api/ai/directions", async (req, res) => {
  const parsed = DirectionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { originAddress, destinationName, destinationCoords } = parsed.data;

  try {
    // Geocode the origin address using the HC composite locator
    const originResolved = await geocodeResolve({ text: originAddress });

    // Get the route
    const route = await getRoute(
      { x: originResolved.location.x, y: originResolved.location.y },
      destinationCoords
    );

    if (!route) {
      return res.status(500).json({
        success: false,
        error: "Could not calculate route. Make sure ARCGIS_API_KEY is configured."
      });
    }

    return res.json({
      success: true,
      origin: {
        address: originResolved.matchedAddress,
        geometry: originResolved.location
      },
      destination: {
        name: destinationName,
        geometry: destinationCoords
      },
      route: route
    });
  } catch (err: any) {
    console.error("Directions error:", err);
    const msg = err?.message ?? "Failed to get directions";
    if ((err as any).code === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: `Could not find address: ${originAddress}` });
    }
    return res.status(500).json({ success: false, error: msg });
  }
});

// Shelter search endpoint
const ShelterSearchSchema = z.object({
  address: z.string().min(3, "Address is required"),
  filters: z.array(z.string()).optional(),
  nearest: z.boolean().optional(),
  maxResults: z.number().optional()
});

// Shelter layer URL
const SHELTER_LAYER_URL = "https://services.arcgis.com/apTfC6SUmnNfnxuF/arcgis/rest/services/HEAT_2026_Webmap/FeatureServer/0";

app.post("/api/shelters/search", async (req, res) => {
  const parsed = ShelterSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { address, filters = [], nearest = true, maxResults = 10 } = parsed.data;

  try {
    // Geocode the address
    const geocoded = await geocodeResolve({ text: address });
    const originPoint = geocoded.location;

    // Build where clause from filters
    let whereClause = "1=1";
    if (filters.length > 0) {
      whereClause = filters.join(" AND ");
    }

    // Query shelters
    const queryUrl = new URL(`${SHELTER_LAYER_URL}/query`);
    const params: Record<string, string> = {
      f: "json",
      where: whereClause,
      outFields: "*",
      returnGeometry: "true",
      outSR: "102100"
    };

    // If nearest is requested, use distance ordering
    if (nearest) {
      // Use geometry parameter to order by distance
      params.geometry = JSON.stringify({
        x: originPoint.x,
        y: originPoint.y,
        spatialReference: { wkid: 102100 }
      });
      params.geometryType = "esriGeometryPoint";
      params.spatialRel = "esriSpatialRelIntersects";
      params.distance = "80467"; // ~50 miles in meters
      params.units = "esriSRUnit_Meter";
      params.orderByFields = ""; // ArcGIS Online doesn't support distance ordering, we'll sort manually
    }

    const queryBody = new URLSearchParams(params);
    const queryResp = await fetch(queryUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: queryBody.toString()
    });

    if (!queryResp.ok) {
      throw new Error(`Shelter query failed: ${queryResp.status}`);
    }

    const queryJson = await queryResp.json() as {
      features?: Array<{
        attributes: Record<string, any>;
        geometry?: { x: number; y: number };
      }>;
      error?: { message: string };
    };

    if (queryJson.error) {
      throw new Error(queryJson.error.message);
    }

    // Process results and calculate distances
    interface ShelterResult {
      [key: string]: any;
      _geometry?: { x: number; y: number };
      DISTANCE_MILES?: number;
    }

    let shelters: ShelterResult[] = (queryJson.features || []).map((f) => {
      const shelter: ShelterResult = {
        ...f.attributes,
        _geometry: f.geometry
      };

      // Calculate distance if we have geometry
      if (f.geometry && nearest) {
        const dx = f.geometry.x - originPoint.x;
        const dy = f.geometry.y - originPoint.y;
        const distanceMeters = Math.sqrt(dx * dx + dy * dy);
        const distanceMiles = distanceMeters / 1609.344; // Convert to miles
        shelter.DISTANCE_MILES = distanceMiles;
      }

      return shelter;
    });

    // Sort by distance if nearest is requested
    if (nearest) {
      shelters.sort((a, b) => (a.DISTANCE_MILES ?? Infinity) - (b.DISTANCE_MILES ?? Infinity));
    }

    // Limit results
    shelters = shelters.slice(0, maxResults);

    return res.json({
      success: true,
      shelters,
      geocodedLocation: {
        address: geocoded.matchedAddress,
        geometry: originPoint
      }
    });
  } catch (err: any) {
    console.error("Shelter search error:", err);
    const msg = err?.message ?? "Shelter search failed";
    if ((err as any).code === "NOT_FOUND") {
      return res.status(404).json({ success: false, error: `Could not find address: ${address}`, shelters: [] });
    }
    return res.status(500).json({ success: false, error: msg, shelters: [] });
  }
});

// Alerts & Messaging endpoint with server-side cache
const ALERTS_TABLE_URL = "https://services.arcgis.com/apTfC6SUmnNfnxuF/arcgis/rest/services/Alerts_and_Messaging/FeatureServer/0";

let alertsCache: { data: any; timestamp: number } | null = null;
const ALERTS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

app.get("/api/alerts", async (_req, res) => {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (alertsCache && (now - alertsCache.timestamp) < ALERTS_CACHE_TTL) {
      return res.json(alertsCache.data);
    }

    // Query active alerts: StartTime <= now AND (EndTime is null OR EndTime >= now)
    const nowUtc = new Date().toISOString();
    const whereClause = `StartTime <= '${nowUtc}' AND (EndTime IS NULL OR EndTime >= '${nowUtc}')`;

    const queryUrl = new URL(`${ALERTS_TABLE_URL}/query`);
    const params = new URLSearchParams({
      f: "json",
      where: whereClause,
      outFields: "StormName,Message,Severity,StartTime,EndTime,EditDate",
      orderByFields: "EditDate DESC",
      returnGeometry: "false"
    });

    const queryResp = await fetch(queryUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    if (!queryResp.ok) {
      throw new Error(`Alerts query failed: ${queryResp.status}`);
    }

    const queryJson = await queryResp.json() as {
      features?: Array<{ attributes: Record<string, any> }>;
      error?: { message: string };
    };

    if (queryJson.error) {
      throw new Error(queryJson.error.message);
    }

    const alerts = (queryJson.features || []).map((f) => f.attributes);

    // Sort: critical first, then warning, then info; within each severity by EditDate desc
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const sa = severityOrder[a.Severity] ?? 3;
      const sb = severityOrder[b.Severity] ?? 3;
      if (sa !== sb) return sa - sb;
      return (b.EditDate ?? 0) - (a.EditDate ?? 0);
    });

    // Also fetch open shelters
    let shelters: Record<string, any>[] = [];
    try {
      const shelterParams = new URLSearchParams({
        f: "json",
        where: "status='Open'",
        outFields: "*",
        orderByFields: "shelter_na ASC",
        returnGeometry: "true",
        outSR: "102100"
      });

      const shelterResp = await fetch(`${SHELTER_LAYER_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: shelterParams.toString()
      });

      if (shelterResp.ok) {
        const shelterJson = await shelterResp.json() as {
          features?: Array<{ attributes: Record<string, any> }>;
          error?: { message: string };
        };
        if (!shelterJson.error) {
          shelters = (shelterJson.features || []).map((f) => ({
            ...f.attributes,
            _geometry: f.geometry
          }));
        }
      }
    } catch (shelterErr) {
      console.warn("Failed to fetch shelters for alerts panel:", shelterErr);
    }

    const responseData = { success: true, alerts, shelters, fetchedAt: now };

    // Update cache
    alertsCache = { data: responseData, timestamp: now };

    return res.json(responseData);
  } catch (err: any) {
    console.error("Alerts fetch error:", err);
    // Return stale cache if available
    if (alertsCache) {
      return res.json({ ...alertsCache.data, stale: true });
    }
    return res.status(500).json({ success: false, error: err?.message ?? "Failed to fetch alerts" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
