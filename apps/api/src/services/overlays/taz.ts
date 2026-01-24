import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy-faithful TAZ:
 * - label: "TAZ"
 * - value: attr.TAZ
 */

export function tazRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const taz = getStringAttr(a, "TAZ");
    if (taz) {
      rows.push({ label: "TAZ", value: taz });
    }
  }

  return rows;
}
