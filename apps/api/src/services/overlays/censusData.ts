import type { ResultRow } from "@dsd/shared";
import { getStringAttr } from "./utils.js";

/**
 * Legacy:
 * label: "Census Data"
 * value: "Tract: {TRACT}\nBlock: {BLOCKCE10}"
 */

export function censusDataRowsFromFeatures(
  features: Array<{ attributes?: Record<string, any> }>
): ResultRow[] {
  const rows: ResultRow[] = [];

  for (const f of features ?? []) {
    const a = f?.attributes ?? {};
    const tract = getStringAttr(a, "TRACT");
    if (tract) {
      const block = getStringAttr(a, "BLOCKCE10") ?? "";
      rows.push({
        label: "Census Data",
        value: `Tract: ${tract}\nBlock: ${block}`,
      });
    }
  }

  return rows;
}
