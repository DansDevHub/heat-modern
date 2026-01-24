// apps/api/src/services/ollamaService.ts

import { OVERLAYS } from "./overlays/overlayRegistry";

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral:latest";

// Available layers for spatial queries
const AVAILABLE_LAYERS = [
  // From overlay registry
  ...OVERLAYS.map(o => ({
    key: o.key,
    title: o.title,
    url: o.url,
    description: getLayerDescription(o.key)
  })),
  // Additional layers not in overlay registry but available for queries
  // Using FeatureServer where available for better query support
  {
    key: "parcels",
    title: "Parcels",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/FeatureServer/0",
    description: "Property parcels with folio numbers, addresses, owner information"
  },
  {
    key: "schools",
    title: "Schools",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/9",
    description: "School locations in Hillsborough County"
  },
  {
    key: "fireStations",
    title: "Fire Stations",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/2",
    description: "Fire station locations"
  },
  {
    key: "hospitals",
    title: "Hospitals",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/8",
    description: "Hospital locations"
  },
  {
    key: "parks",
    title: "Parks",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/4",
    description: "Park locations"
  },
  {
    key: "shelters",
    title: "Shelters",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/10",
    description: "Emergency shelter locations"
  },
  {
    key: "waterTreatment",
    title: "Water Treatment Plants",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/CORPORATE/HC_WASTEWATER/MapServer/10",
    description: "Wastewater treatment plant locations"
  },
  {
    key: "productionWells",
    title: "Production Wells",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/Wells/FeatureServer/0",
    description: "Production well locations"
  },
  {
    key: "communityWells",
    title: "Community Wells",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/Wells/FeatureServer/1",
    description: "Community well locations"
  },
  {
    key: "communityWellsBuffer",
    title: "Community Potable Wells Buffer",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/Wells/FeatureServer/2",
    description: "Buffer zones around community potable wells"
  },
  {
    key: "wellheads",
    title: "Wellheads",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/Wells/FeatureServer/3",
    description: "Wellhead protection areas"
  },
  {
    key: "ntncWells",
    title: "NTNC Wells",
    url: "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/Wells/FeatureServer/4",
    description: "Non-transient non-community wells and community wells"
  },
  {
    key: "commissionerDistricts",
    title: "Commissioner Districts",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/1",
    description: "County Commissioner district boundaries - use for 'what district is X in' questions"
  },
  {
    key: "cities",
    title: "City Boundaries",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/0",
    description: "City and municipality boundaries - use for 'what city is X in' questions"
  },
  {
    key: "zipCodes",
    title: "ZIP Codes",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/DisplayLayers/FeatureServer/6",
    description: "ZIP code boundaries - use for 'what zip code is X in' questions"
  }
];

function getLayerDescription(key: string): string {
  const descriptions: Record<string, string> = {
    zoning: "Zoning districts and classifications",
    flood: "FEMA flood zones and hazard areas",
    oldFlood: "Pre-2008 flood zone data",
    communityBasePlanningArea: "Community plan areas for local planning",
    countyWidePlanningArea: "Countywide planning areas",
    futureLanduse: "Future land use designations",
    urbanServiceArea: "Urban service area boundaries",
    censusData: "Census tract demographic data",
    taz: "Transportation analysis zones for traffic planning",
    plannedDevelopment: "Planned development districts",
    fireFee: "Fire impact fee districts",
    parksFee: "Parks impact fee districts",
    transFee: "Transportation impact fee districts",
    windCat1: "Wind borne debris region - Category 1 hurricane",
    windCat2: "Wind borne debris region - Category 2 hurricane",
    windCat3: "Wind borne debris region - Category 3 hurricane",
    windCat4: "Wind borne debris region - Category 4 hurricane",
    overlayArea: "Special overlay zoning areas",
    firm: "FEMA FIRM panel boundaries",
    hcaaTea: "Hillsborough County Aviation Authority TEA zones",
    hcaaLf: "HCAA Landfill notification areas",
    hcaaSchool: "HCAA Non-compatible use areas for schools",
    hcaaA: "HCAA Airport height zones",
    cotWater: "City of Tampa water service areas",
    cotWastewater: "City of Tampa wastewater service areas",
    mobilityAssess: "Mobility assessment fee districts",
    mobilityBenefit: "Mobility benefit fee districts",
    competitiveSites: "Economic development competitive sites",
    redevelopmentAreas: "Community redevelopment areas",
    historicalResources: "Historic resource locations",
    productionWells: "Production well locations",
    communityWells: "Community well locations",
    communityWellsBuffer: "Buffer zones around community potable wells",
    wellheads: "Wellhead protection areas",
    ntncWells: "Non-transient non-community wells and community wells"
  };
  return descriptions[key] || `${key} layer data`;
}

// Query execution plan generated by LLM
export interface QueryPlan {
  description: string;
  steps: QueryStep[];
  outputFields: string[];
}

export interface QueryStep {
  stepNumber: number;
  action: "query" | "buffer" | "intersect" | "filter" | "count" | "geocode" | "nearest" | "queryAtPoint";
  layerKey?: string;
  layerUrl?: string;
  address?: string;  // For geocode action
  bufferDistance?: number;
  bufferUnit?: "feet" | "miles" | "meters";
  whereClause?: string;
  maxResults?: number;  // For nearest action (default 1)
  description: string;
}

export interface RouteInfo {
  totalDistance: number; // miles
  totalTime: number; // minutes
  directions: Array<{
    text: string;
    length: number; // miles
    time: number; // minutes
  }>;
  geometry: {
    paths: number[][][];
    spatialReference: { wkid: number };
  };
}

export interface QueryResult {
  success: boolean;
  question: string;
  plan: QueryPlan;
  results: any[];
  summary: string;
  error?: string;
  geocodedLocation?: {
    address: string;
    geometry: any;
  };
  route?: RouteInfo;
}

// System prompt for the LLM to understand spatial queries
const SYSTEM_PROMPT = `You are a GIS query assistant for Hillsborough County, Florida. You help users query geographic data layers to answer spatial questions.

Available layers for queries:
${AVAILABLE_LAYERS.map(l => `- ${l.key}: ${l.title} - ${l.description}`).join('\n')}

When a user asks a spatial question, you must respond with a JSON query plan. The plan should include:
1. A description of what you're going to do
2. Steps to execute (query layers, buffer geometries, find intersections, geocode addresses, find nearest)
3. Output fields to return

Available actions:
- "geocode": Convert an address to a location point (specify address field)
- "query": Query a layer with optional WHERE clause
- "buffer": Create a buffer around features from previous step (specify distance and unit)
- "intersect": Find features from a layer that intersect geometry from previous step
- "nearest": Find nearest features from a layer to the point from previous step (specify maxResults, default 1)
- "queryAtPoint": Query a polygon layer to find what contains the point from previous step (use for "what district/zone/area is X in" questions)
- "filter": Filter results based on attributes
- "count": Count features

Example question: "Find the nearest school to 663 Flamingo Dr"

Example response:
{
  "description": "Find the nearest school to 663 Flamingo Dr",
  "steps": [
    {
      "stepNumber": 1,
      "action": "geocode",
      "address": "663 Flamingo Dr",
      "description": "Geocode the address to get location coordinates"
    },
    {
      "stepNumber": 2,
      "action": "nearest",
      "layerKey": "schools",
      "maxResults": 1,
      "description": "Find the nearest school to the geocoded location"
    }
  ],
  "outputFields": ["NAME", "ADDRESS", "SCHOOL_TYPE"]
}

Example question: "Which schools are within 500 feet of a water treatment plant?"

Example response:
{
  "description": "Find schools within 500 feet of water treatment plants",
  "steps": [
    {
      "stepNumber": 1,
      "action": "query",
      "layerKey": "waterTreatment",
      "description": "Get all water treatment plant locations"
    },
    {
      "stepNumber": 2,
      "action": "buffer",
      "layerKey": "waterTreatment",
      "bufferDistance": 500,
      "bufferUnit": "feet",
      "description": "Create 500-foot buffer around treatment plants"
    },
    {
      "stepNumber": 3,
      "action": "intersect",
      "layerKey": "schools",
      "description": "Find schools that intersect the buffer zones"
    }
  ],
  "outputFields": ["NAME", "ADDRESS", "SCHOOL_TYPE"]
}

Example question: "Find the 3 closest hospitals to 123 Main St Tampa"

Example response:
{
  "description": "Find the 3 closest hospitals to 123 Main St Tampa",
  "steps": [
    {
      "stepNumber": 1,
      "action": "geocode",
      "address": "123 Main St Tampa",
      "description": "Geocode the address to get location coordinates"
    },
    {
      "stepNumber": 2,
      "action": "nearest",
      "layerKey": "hospitals",
      "maxResults": 3,
      "description": "Find the 3 nearest hospitals to the location"
    }
  ],
  "outputFields": ["NAME", "ADDRESS", "FACILITY_TYPE"]
}

Example question: "What commissioner district is 663 Flamingo Dr in?"

Example response:
{
  "description": "Find the commissioner district containing 663 Flamingo Dr",
  "steps": [
    {
      "stepNumber": 1,
      "action": "geocode",
      "address": "663 Flamingo Dr",
      "description": "Geocode the address to get location coordinates"
    },
    {
      "stepNumber": 2,
      "action": "queryAtPoint",
      "layerKey": "commissionerDistricts",
      "description": "Find which commissioner district contains this location"
    }
  ],
  "outputFields": ["DISTRICT", "NAME", "COMMISSIONER"]
}

Example question: "What zoning is 123 Main St?"

Example response:
{
  "description": "Find the zoning district for 123 Main St",
  "steps": [
    {
      "stepNumber": 1,
      "action": "geocode",
      "address": "123 Main St",
      "description": "Geocode the address to get location coordinates"
    },
    {
      "stepNumber": 2,
      "action": "queryAtPoint",
      "layerKey": "zoning",
      "description": "Find the zoning district at this location"
    }
  ],
  "outputFields": ["ZONING", "DESCRIPTION"]
}

IMPORTANT:
- Always respond with valid JSON only, no markdown or explanation
- Use the exact layer keys provided above
- For questions about "nearest" or "closest" to an address, use geocode first, then nearest
- For questions about "what district/zone/area is X in", use geocode first, then queryAtPoint
- For distance queries like "within X feet", use buffer and intersect
- For distance queries, always specify bufferDistance and bufferUnit
- Common units: "feet", "miles", "meters"

If you cannot answer the question with the available layers, respond with:
{
  "error": "Cannot answer this question because [reason]",
  "suggestion": "Try asking about [alternative]"
}`;

export async function generateQueryPlan(userQuestion: string): Promise<QueryPlan | { error: string; suggestion?: string }> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: userQuestion,
      system: SYSTEM_PROMPT,
      stream: false,
      format: "json"
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const responseText = data.response;

  try {
    const plan = JSON.parse(responseText);

    // Validate the plan structure
    if (plan.error) {
      return plan;
    }

    if (!plan.steps || !Array.isArray(plan.steps)) {
      throw new Error("Invalid plan: missing steps array");
    }

    // Add layer URLs to steps
    for (const step of plan.steps) {
      const layer = AVAILABLE_LAYERS.find(l => l.key === step.layerKey);
      if (layer) {
        step.layerUrl = layer.url;
      }
    }

    return plan as QueryPlan;
  } catch (parseError) {
    console.error("Failed to parse LLM response:", responseText);
    throw new Error(`Failed to parse query plan: ${parseError}`);
  }
}

export async function generateSummary(question: string, results: any[]): Promise<string> {
  // Filter out internal fields from results for cleaner summary
  const cleanResults = results.map(r => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(r)) {
      if (!k.startsWith("_") && !["SHAPE", "geometry", "rings", "paths"].includes(k)) {
        clean[k] = v;
      }
    }
    return clean;
  });

  const summaryPrompt = `You are answering a geographic question directly and concisely.

Question: ${question}
Results: ${JSON.stringify(cleanResults.slice(0, 3), null, 2)}

Provide a direct, single-sentence answer. Examples of good responses:
- "663 Flamingo Dr is in Commissioner District 4."
- "The nearest school is Hillsborough High School, 0.5 miles away."
- "Found 3 schools within 500 feet of water treatment plants."
- "123 Main St is zoned RS-50 (Residential Single Family)."

Do NOT start with phrases like "Based on the results" or "The query shows". Just give the direct answer.`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: summaryPrompt,
      stream: false
    })
  });

  if (!response.ok) {
    return `Found ${results.length} results.`;
  }

  const data = await response.json();
  return data.response?.trim() || `Found ${results.length} results.`;
}

export function getAvailableLayers() {
  return AVAILABLE_LAYERS;
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
