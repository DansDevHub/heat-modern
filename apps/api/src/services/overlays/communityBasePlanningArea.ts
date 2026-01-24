import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy: "Community Base Planning Area" = attr.CPA
 */

export function communityBasePlanningAreaRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const cpa = getStringAttr(a, "CPA");
    if (cpa) {
      rows.push({ label: "Community Base Planning Area", value: cpa });
    }
  }

  return rows;
}
