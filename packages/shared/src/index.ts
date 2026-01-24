export type SpatialReference = { wkid?: number; latestWkid?: number };

export type Point = { x: number; y: number; spatialReference?: SpatialReference };
export type Polygon = { rings: number[][][]; spatialReference?: SpatialReference };

export type ParcelAttributes = {
  FOLIO_NUMB?: string;
  PIN?: string;
  OWNER?: string;
  ACREAGE?: number;
  SITE_ADDR?: string;
  SITE_CITY?: string;
  SITE_ZIP?: string;
  // keep this loose; you can tighten it as you port fields
  [k: string]: unknown;
};

export type ParcelFeature = {
  attributes: ParcelAttributes;
  geometry?: Polygon;
};

export type ParcelLookupRequest =
  | { type: "point"; point: Point }
  | { type: "folio"; folio: string };

export type ResultRow = { label: string; value: string };

export type ResultsResponse = {
  parcel: ParcelFeature;
  jurisdiction?: string;
  rows: ResultRow[];
  // optionally include richer sections for UI grouping
  sections?: Record<string, ResultRow[]>;
};
