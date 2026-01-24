import type { ResultRow } from "@dsd/shared";
import { getAttr, getStringAttr } from "./utils.js";

/**
 * Legacy: "County Wide Planning Area" = attr.PLANAREA
 * (Legacy checks attr.NAME !== "" but outputs PLANAREA.)
 */

export function countyWidePlanningAreaRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};

    // Legacy gating: if (attr.NAME !== "")
    const nameGate = getAttr(a, "NAME");
    if (nameGate === "" || nameGate === null || nameGate === undefined) continue;

    const planArea = getStringAttr(a, "PLANAREA");
    if (planArea) {
      rows.push({ label: "County Wide Planning Area", value: planArea });
    }
  }

  return rows;
}
