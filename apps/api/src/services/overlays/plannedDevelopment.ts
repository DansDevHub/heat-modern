import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy Planned Development rows:
 * - "Planned Development" = NZONE
 * - "Re-zoning"          = RZ
 * - "Note"              = NOTES
 * - "Minor Changes"     = MC
 */

export function plannedDevelopmentRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};

    const nzone = getStringAttr(a, "NZONE");
    if (nzone) {
      rows.push({ label: "Planned Development", value: nzone });
    }

    const rz = getStringAttr(a, "RZ");
    if (rz) {
      rows.push({ label: "Re-zoning", value: rz });
    }

    const notes = getStringAttr(a, "NOTES");
    if (notes) {
      rows.push({ label: "Note", value: notes });
    }

    const mc = getStringAttr(a, "MC");
    if (mc) {
      rows.push({ label: "Minor Changes", value: mc });
    }
  }

  return rows;
}
