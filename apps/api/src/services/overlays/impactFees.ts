import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy-faithful Impact Fee rows:
 * Uses attr.DATA and emits one row per intersecting feature.
 */

export function impactFeeRowsFromFeatures(
  label: string,
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const data = getStringAttr(a, "DATA");
    if (data) {
      rows.push({ label, value: data });
    }
  }

  return rows;
}
