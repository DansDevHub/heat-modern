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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});
