import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * "Extras" overlays:
 * - City of Tampa water/wastewater service areas
 * - Competitive sites, redevelopment areas, historical resources
 *
 * These services vary in attribute field names. This mapper is intentionally
 * resilient (legacy widget often just indicated presence / returned a label).
 *
 * Behavior: one row per intersecting feature (legacy-style).
 */

function presentValue(a: Record<string, any>): string {
  // Prefer "name-ish" fields, then "data-ish", then IDs, then a generic presence string.
  const candidates = [
    "NAME",
    "TITLE",
    "TYPE",
    "CATEGORY",
    "DATA",
    "DESC",
    "DESCRIPTION",
    "LABEL",
    "ID",
    "OBJECTID",
  ];

  for (const k of candidates) {
    const v = getStringAttr(a, k);
    if (v) return v;
  }
  return "Present";
}

/** Generic: emits `label = <picked value>` for each intersecting feature. */
export function extrasRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    rows.push({ label, value: presentValue(a) });
  }

  return rows;
}

/**
 * For service areas (COT), prefer "DATA" / "NAME" first.
 * If nothing, fall back to "Present".
 */
export function serviceAreaRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const v =
      getStringAttr(a, "DATA") ??
      getStringAttr(a, "NAME") ??
      getStringAttr(a, "SERVICE") ??
      getStringAttr(a, "AREA") ??
      "Present";
    rows.push({ label, value: v });
  }

  return rows;
}
