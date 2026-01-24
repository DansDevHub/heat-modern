import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy-faithful "InfoLayers" style overlays:
 * Most of these layers return a single intersect feature and a single useful
 * attribute value. We emit one row per feature (legacy behavior).
 *
 * Tries DATA first, then falls back to common name-ish fields.
 * Uses case-insensitive field matching.
 */

const pickValue = (a: Record<string, any>) => {
  // Most InfoLayers use DATA; others sometimes use NAME / PANEL / ID-ish fields.
  const candidates = [
    "DATA",
    "NAME",
    "LABEL",
    "TYPE",
    "PANEL",
    "FIRM_PANEL",
    "FIRM",
    "FIRMID",
    "FIRM_ID",
    "FLD_PANEL",
    "ID",
    "ZONE",
  ];

  for (const k of candidates) {
    const v = getStringAttr(a, k);
    if (v) return v;
  }
  return null;
};

export function simpleInfoLayerRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const v = pickValue(a);
    if (v) rows.push({ label, value: v });
  }

  return rows;
}
