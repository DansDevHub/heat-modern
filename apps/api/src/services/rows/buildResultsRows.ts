import type { ParcelFeature, ResultRow } from "@dsd/shared";

/**
 * Builds the rows used by the parcel details table (Site Info).
 *
 * Goal:
 * - Deterministic ordering
 * - No duplicate labels
 * - Clean formatting (currency, acreage, etc.)
 * - Easy to extend later with extra sections (buffer/layer results)
 */
export async function buildResultsRows(parcel: ParcelFeature): Promise<ResultRow[]> {
  const a = parcel.attributes ?? {};
  const rows: ResultRow[] = [];

  // --- helpers ---------------------------------------------------------------
  const seen = new Set<string>();

  const addRow = (label: string, value: unknown) => {
    if (value === null || value === undefined) return;

    const s = String(value).trim();
    if (!s) return;

    // Prevent accidental duplicates if upstream has aliases / repeats
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    rows.push({ label, value: s });
  };

  const money = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(/[$,]/g, ""));
    if (!Number.isFinite(n)) return null;
    return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  };

  const numberish = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // --- “Site Info” ordering (matches the nice block you showed) --------------
  // Keep this list in the exact order you want it displayed.

  // Jurisdiction (sometimes comes as JURISDICTION, sometimes something else)
  addRow("Jurisdiction", a.JURISDICTION ?? a.JURISDICT ?? a.JURIS ?? a.JURISD);

  // Parcel identifiers
  addRow("Folio", a.FOLIO_NUMB ?? a.FOLIO ?? a.FOLIO_NUMBER);
  addRow("PIN", a.PIN ?? a.PARCEL_ID ?? a.PARCELID);

  // Ownership
  addRow("Owner", a.OWNER ?? a.OWNER_NAME);

  // Addresses
  addRow("Mailing Address", a.MAILING_ADDR ?? a.MAIL_ADDR ?? a.MAILADDR);
  addRow("Site Address", a.SITE_ADDR ?? a.SITUS_ADDR ?? a.SITUSADDR);

  // Legal / size / value
  addRow("SEC-TWN-RNG", a.SEC_TWN_RNG ?? a.SECTWN ?? a.SECTION_TWP_RNG);

  const acres = numberish(a.ACREAGE ?? a.ACRES);
  if (acres !== null) addRow("Acreage", acres);

  const mv = money(a.MARKET_VALUE ?? a.MKT_VALUE ?? a.MARKETVAL);
  if (mv) addRow("Market Value", mv);

  // Land use
  addRow("Landuse Code", a.LANDUSE_CODE ?? a.LANDUSE ?? a.LU_CODE);
  addRow("Landuse", a.LANDUSE_DESC ?? a.LU_DESC ?? a.LANDUSE_DESCRIPTION);

  return rows;
}
