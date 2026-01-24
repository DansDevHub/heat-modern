import type { ResultRow } from "@dsd/shared";
import { getAttr, getStringAttr } from "./utils.js";

/**
 * Legacy-exact flood logic ported from Widget.js:
 * - Current Effective Flood Zone rows:
 *    label: "Flood Zone:<FLD_ZONE>"
 *    value: optional FLOODWAY + optional "BFE = X.X ft"
 * - Pre 2008 Flood Zone rows:
 *    label: "Pre 2008 Flood Zone"
 *    value: ZONE (+ FLOODWAY if present)
 *   plus:
 *    label: "Pre 2008 Firm Panel"
 *    value: FIRM_PANEL (from the last/any feature)
 */

export function currentFloodRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};

    const zone = getStringAttr(a, "FLD_ZONE");
    if (!zone) continue;

    const parts: string[] = [];

    // Legacy appends FLOODWAY if not " "
    const floodway = getStringAttr(a, "FLOODWAY");
    if (floodway) {
      parts.push(floodway);
    }

    // Legacy appends STATIC_BFE if !== -9999, formatted to 1 decimal, with " ft"
    const bfeRaw = getAttr(a, "STATIC_BFE");
    const bfe = Number(bfeRaw);
    if (Number.isFinite(bfe) && bfe !== -9999) {
      parts.push(`BFE = ${bfe.toFixed(1)} ft`);
    }

    rows.push({
      label: `Flood Zone:${zone}`,
      value: parts.length ? parts.join("\n") : "",
    });
  }

  return rows;
}

export function pre2008FloodRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];
  let firmPanel: string | undefined;

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};

    const zone = getStringAttr(a, "ZONE");
    if (!zone) continue;

    const floodway = getStringAttr(a, "FLOODWAY");

    rows.push({
      label: "Pre 2008 Flood Zone",
      value: floodway ? `${zone}\n${floodway}` : zone,
    });

    const panel = getStringAttr(a, "FIRM_PANEL");
    if (panel) {
      firmPanel = panel;
    }
  }

  if (firmPanel) {
    rows.push({ label: "Pre 2008 Firm Panel", value: firmPanel });
  }

  return rows;
}
