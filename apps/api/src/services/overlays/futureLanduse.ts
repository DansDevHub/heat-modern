import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy: "Future Landuse" = attr.FLUE
 */

export function futureLanduseRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const flue = getStringAttr(a, "FLUE");
    if (flue) {
      rows.push({ label: "Future Landuse", value: flue });
    }
  }

  return rows;
}
