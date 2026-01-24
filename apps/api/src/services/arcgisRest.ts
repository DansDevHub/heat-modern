import fetch from "node-fetch";

export type ArcGISQueryParams = Record<string, string | number | boolean | undefined>;

export async function arcgisGetJson<T>(url: string, params: ArcGISQueryParams): Promise<T> {
  const u = new URL(url);
  Object.entries({ f: "json", ...params }).forEach(([k, v]) => {
    if (v === undefined) return;
    u.searchParams.set(k, String(v));
  });

  console.log("arcgisGetJson URL:", u.toString().substring(0, 200));
  const resp = await fetch(u.toString(), { method: "GET" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("ArcGIS request failed. Status:", resp.status);
    console.error("Response text:", text.slice(0, 500));
    throw new Error(`ArcGIS request failed ${resp.status}: ${text.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}

// POST version for large payloads (e.g., geometry queries with many coordinates)
export async function arcgisPostJson<T>(url: string, params: ArcGISQueryParams): Promise<T> {
  const body = new URLSearchParams();
  Object.entries({ f: "json", ...params }).forEach(([k, v]) => {
    if (v === undefined) return;
    body.set(k, String(v));
  });

  console.log("arcgisPostJson URL:", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("ArcGIS POST request failed. Status:", resp.status);
    console.error("Response text:", text.slice(0, 500));
    throw new Error(`ArcGIS request failed ${resp.status}: ${text.slice(0, 500)}`);
  }
  return (await resp.json()) as T;
}
