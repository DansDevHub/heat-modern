import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

export function zoningRowsFromAttributes(a: Record<string, any>): ResultRow[] {
  const rows: ResultRow[] = [];

  const add = (label: string, key: string) => {
    const v = getStringAttr(a, key);
    if (v) rows.push({ label, value: v });
  };

  add("Zoning Category", "CATEGORY");
  add("FLX", "FLX");
  add("INFL", "INFIL");
  add("Zoning", "NZONE");
  add("Description", "NZONE_DESC");
  add("Overlay", "OVERLAY");
  add("RS", "RS");
  add("RZ", "RZ");
  add("Restr", "RESTR");
  add("ZC", "ZC");

  return rows;
}
