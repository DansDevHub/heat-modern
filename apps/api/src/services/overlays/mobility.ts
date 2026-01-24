import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy-faithful Mobility rows:
 * - Mobility Assessment District -> attr.DATA
 * - Mobility Benefit District    -> attr.Pot_MFZ
 *
 * Emit one row per intersecting feature (legacy behavior).
 */

export function mobilityAssessmentRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const data = getStringAttr(a, "DATA");
    if (data) {
      rows.push({ label: "Mobility Assessment District", value: data });
    }
  }
  return rows;
}

export function mobilityBenefitRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const potMfz = getStringAttr(a, "Pot_MFZ");
    if (potMfz) {
      rows.push({ label: "Mobility Benefit District", value: potMfz });
    }
  }
  return rows;
}
