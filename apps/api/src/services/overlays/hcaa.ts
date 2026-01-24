import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy-faithful HCAA rows:
 * - TEA / Landfill / School layers expose "Layer"
 * - HCAA A exposes "Name"
 *
 * Emit one row per intersect feature (legacy behavior).
 */

export function hcaaLayerRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const layer = getStringAttr(a, "Layer");
    if (layer) {
      rows.push({ label, value: layer });
    }
  }

  return rows;
}

export function hcaaNameRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const name = getStringAttr(a, "Name");
    if (name) {
      rows.push({ label, value: name });
    }
  }

  return rows;
}
