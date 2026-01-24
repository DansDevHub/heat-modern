import { arcgisGetJson } from "./arcgisRest.js";
import type { ParcelLookupRequest, ParcelFeature } from "@dsd/shared";

// Legacy service endpoints observed in the Results widget code.
const PARCEL_LAYER_URL = "https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_Parcels/MapServer/0/query";

type FeatureSet = { features: ParcelFeature[] };

export async function lookupParcel(req: ParcelLookupRequest): Promise<ParcelFeature> {
  if (req.type === "point") {
    const geometry = JSON.stringify(req.point);
    const fs = await arcgisGetJson<FeatureSet>(PARCEL_LAYER_URL, {
      where: "1=1",
      geometry,
      geometryType: "esriGeometryPoint",
      inSR: req.point.spatialReference?.wkid ?? 102100,
      outFields: "*",
      returnGeometry: true,
      outSR: req.point.spatialReference?.wkid ?? 102100
    });
    if (!fs.features?.length) throw new Error("Parcel not found at location.");
    return fs.features[0];
  }

  // folio
  const folio = req.folio.replace(/^0+/, "");
  const fs = await arcgisGetJson<FeatureSet>(PARCEL_LAYER_URL, {
    where: `FOLIO_NUMB='${folio}'`,
    outFields: "*",
    returnGeometry: true,
    outSR: 102100
  });
  if (!fs.features?.length) throw new Error("Parcel not found.");
  return fs.features[0];
}
