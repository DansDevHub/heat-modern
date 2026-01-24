import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy: "Urban Service Area" = attr.DATA
 */

export function urbanServiceAreaRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const data = getStringAttr(a, "DATA");
    if (data) {
      rows.push({ label: "Urban Service Area", value: data });
    }
  }

  return rows;
}
