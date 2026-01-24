export type OverlayDef = {
  key: string;
  title: string;
  url: string;          // Layer REST URL (…/FeatureServer/<layerId>)
  outFields?: string[]; // default ["*"]
};

export const GEOMETRY_SERVER =
  "https://maps.hillsboroughcounty.org/arcgis/rest/services/Utilities/Geometry/GeometryServer";

// Production FeatureServer base URL
const DSD_VIEWER_LAYERS =
  "https://gisdextweb1.hillsboroughcounty.org/arcgis/rest/services/Hosted/DSD_Viewer_Layers/FeatureServer";

// Authoritative set from DSD_Viewer_Layers FeatureServer
export const OVERLAYS: OverlayDef[] = [
  // --- Zoning ---------------------------------------------------------------
  {
    key: "zoning",
    title: "Zoning",
    url: `${DSD_VIEWER_LAYERS}/0`,
    outFields: ["*"],
  },

  // --- Flood ----------------------------------------------------------------
  {
    key: "flood",
    title: "Flood Zone",
    url: `${DSD_VIEWER_LAYERS}/1`,
    outFields: ["*"],
  },
  {
    key: "oldFlood",
    title: "Pre 2008 Flood Zone",
    url: `${DSD_VIEWER_LAYERS}/2`,
    outFields: ["*"],
  },

  // --- Planning / Land Use --------------------------------------------------
  {
    key: "communityBasePlanningArea",
    title: "Community Base Planning Area",
    url: `${DSD_VIEWER_LAYERS}/3`,
    outFields: ["*"],
  },
  {
    key: "countyWidePlanningArea",
    title: "County Wide Planning Area",
    url: `${DSD_VIEWER_LAYERS}/4`,
    outFields: ["*"],
  },
  {
    key: "futureLanduse",
    title: "Future Landuse",
    url: `${DSD_VIEWER_LAYERS}/6`,
    outFields: ["*"],
  },
  {
    key: "urbanServiceArea",
    title: "Urban Service Area",
    url: `${DSD_VIEWER_LAYERS}/7`,
    outFields: ["*"],
  },
  {
    key: "censusData",
    title: "Census Data",
    url: `${DSD_VIEWER_LAYERS}/8`,
    outFields: ["*"],
  },
  {
    key: "taz",
    title: "Transportation Analysis Zone",
    url: `${DSD_VIEWER_LAYERS}/9`,
    outFields: ["*"],
  },
  {
    key: "plannedDevelopment",
    title: "Planned Development",
    url: `${DSD_VIEWER_LAYERS}/30`,
    outFields: ["*"],
  },

  // --- Fees / Districts / Overlays -----------------------------------------
  {
    key: "fireFee",
    title: "Fire Impact Fee",
    url: `${DSD_VIEWER_LAYERS}/10`,
    outFields: ["*"],
  },
  {
    key: "parksFee",
    title: "Parks Impact Fee",
    url: `${DSD_VIEWER_LAYERS}/11`,
    outFields: ["*"],
  },
  {
    key: "transFee",
    title: "Transportation Impact Fee",
    url: `${DSD_VIEWER_LAYERS}/12`,
    outFields: ["*"],
  },
  {
    key: "windCat1",
    title: "Wind Borne Debris Category 1",
    url: `${DSD_VIEWER_LAYERS}/13`,
    outFields: ["*"],
  },
  {
    key: "windCat2",
    title: "Wind Borne Debris Category 2",
    url: `${DSD_VIEWER_LAYERS}/14`,
    outFields: ["*"],
  },
  {
    key: "windCat3",
    title: "Wind Borne Debris Category 3",
    url: `${DSD_VIEWER_LAYERS}/15`,
    outFields: ["*"],
  },
  {
    key: "windCat4",
    title: "Wind Borne Debris Category 4",
    url: `${DSD_VIEWER_LAYERS}/16`,
    outFields: ["*"],
  },
  {
    key: "overlayArea",
    title: "Overlay Area",
    url: `${DSD_VIEWER_LAYERS}/17`,
    outFields: ["*"],
  },
  {
    key: "firm",
    title: "FIRM Panel",
    url: `${DSD_VIEWER_LAYERS}/18`,
    outFields: ["*"],
  },

  // --- Aviation (HCAA) ------------------------------------------------------
  // Note: HCAA TEA is not available in the new FeatureServer, keeping on legacy service
  {
    key: "hcaaTea",
    title: "HCAA TEA",
    url: "https://maps.hillsboroughcounty.org/arcgis/rest/services/DSD_Viewer/HCAA_DSD_FOR_PUB_20170622/MapServer/0",
    outFields: ["Layer"],
  },
  {
    key: "hcaaLf",
    title: "HCAA Landfill",
    url: `${DSD_VIEWER_LAYERS}/19`,
    outFields: ["*"],
  },
  {
    key: "hcaaSchool",
    title: "HCAA School",
    url: `${DSD_VIEWER_LAYERS}/20`,
    outFields: ["*"],
  },
  {
    key: "hcaaA",
    title: "HCAA A",
    url: `${DSD_VIEWER_LAYERS}/21`,
    outFields: ["*"],
  },

  // --- City of Tampa service areas -----------------------------------------
  {
    key: "cotWater",
    title: "City of Tampa Water",
    url: `${DSD_VIEWER_LAYERS}/22`,
    outFields: ["*"],
  },
  {
    key: "cotWastewater",
    title: "City of Tampa Wastewater",
    url: `${DSD_VIEWER_LAYERS}/23`,
    outFields: ["*"],
  },

  // --- Mobility fees --------------------------------------------------------
  {
    key: "mobilityAssess",
    title: "Mobility Assessment District",
    url: `${DSD_VIEWER_LAYERS}/24`,
    outFields: ["*"],
  },
  {
    key: "mobilityBenefit",
    title: "Mobility Benefit District",
    url: `${DSD_VIEWER_LAYERS}/25`,
    outFields: ["*"],
  },

  // --- Zoning / Regulatory extras ------------------------------------------
  {
    key: "competitiveSites",
    title: "Competitive Sites",
    url: `${DSD_VIEWER_LAYERS}/26`,
    outFields: ["*"],
  },
  {
    key: "redevelopmentAreas",
    title: "Redevelopment Areas",
    url: `${DSD_VIEWER_LAYERS}/27`,
    outFields: ["*"],
  },
  {
    key: "historicalResources",
    title: "Historical Resources",
    url: `${DSD_VIEWER_LAYERS}/28`,
    outFields: ["*"],
  },
];
