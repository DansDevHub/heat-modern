import type { Polygon } from "@dsd/shared";

type ArcGISError = { error?: { message?: string; details?: string[] } };

async function postForm<T>(url: string, form: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ f: "json", ...form }).toString();

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await resp.json()) as T & ArcGISError;

  if (!resp.ok || (json as any)?.error) {
    const msg = (json as any)?.error?.message ?? `ArcGIS request failed (${resp.status})`;
    const details = (json as any)?.error?.details?.join(" | ");
    throw new Error(details ? `${msg}: ${details}` : msg);
  }

  return json as T;
}

export async function bufferPolygon(opts: {
  geometryServerUrl: string; // …/GeometryServer
  polygon: Polygon;
  distanceFeet: number; // -1 or +1
  wkid: number;
  unit: number; // 9003
}): Promise<Polygon> {
  const url = `${opts.geometryServerUrl}/buffer`;

  const geometries = {
    geometryType: "esriGeometryPolygon",
    geometries: [
      {
        rings: opts.polygon.rings,
        spatialReference: { wkid: opts.wkid },
      },
    ],
  };

  const out = await postForm<{ geometries?: Polygon[] }>(url, {
    geometries: JSON.stringify(geometries),
    inSR: String(opts.wkid),
    outSR: String(opts.wkid),
    distances: String(opts.distanceFeet),
    unit: String(opts.unit),
    unionResults: "true",
  });

  const g = out?.geometries?.[0];
  if (!g?.rings) throw new Error("GeometryServer buffer returned no geometry.");
  return g;
}

export async function queryLayerByGeometry(opts: {
  layerUrl: string; // …/FeatureServer/<id> or …/MapServer/<id>
  geometry: Polygon;
  wkid: number;
  outFields?: string[];
  returnGeometry?: boolean; // default false
}): Promise<{ features: Array<{ attributes: Record<string, any>; geometry?: any }> }> {
  const url = `${opts.layerUrl}/query`;

  const geomJson = JSON.stringify({
    rings: opts.geometry.rings,
    spatialReference: { wkid: opts.wkid },
  });

  return postForm(url, {
    where: "1=1",
    geometry: geomJson,
    geometryType: "esriGeometryPolygon",
    spatialRel: "esriSpatialRelIntersects",
    inSR: String(opts.wkid), // Ensures server projects input geometry correctly
    returnGeometry: opts.returnGeometry ? "true" : "false",
    outFields: (opts.outFields?.length ? opts.outFields : ["*"]).join(","),
  });
}
