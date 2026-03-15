import { makeTag } from "../utils/makeTag.js";

type ParcelAttrs = Record<string, any>;

function formatMoney(val: any): string | null {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatMailingAddress(a: ParcelAttrs): string | null {
  const addr1 = (a.ADDR_1 ?? "").toString().trim();
  if (!addr1) return null;

  const addr2 = (a.ADDR_2 ?? "").toString().trim();
  const city = (a.CITY ?? "").toString().trim();
  const state = (a.STATE ?? "").toString().trim();
  const zip = (a.ZIP ?? "").toString().trim();

  const line1 = addr1;
  const line2 = addr2 && addr2 !== "" ? addr2 : null;
  const line3 = [city, state, zip].filter(Boolean).join(", ").replace(", ,", ",");

  return [line1, line2, line3].filter(Boolean).join("\n");
}

function formatSiteAddress(a: ParcelAttrs): string | null {
  const addr = (a.SITE_ADDR ?? "").toString().trim();
  if (!addr) return null;

  const city = (a.SITE_CITY ?? "").toString().trim();
  const zip = (a.SITE_ZIP ?? "").toString().trim();

  return [addr, [city, "FL", zip].filter(Boolean).join(" ")].filter(Boolean).join("\n");
}

function deriveSecTwnRngFromPin(pinRaw: any): string | null {
  const pin = (pinRaw ?? "").toString().trim();
  if (!pin.includes("-")) return null;

  // Legacy logic: split PIN on "-" and take [1]-[3] :contentReference[oaicite:4]{index=4}
  const parts = pin.split("-");
  if (parts.length < 4) return null;

  return `${parts[1]}-${parts[2]}-${parts[3]}`;
}

export function buildSiteInfoRows(attrs: ParcelAttrs) {
  const pin = (attrs.PIN ?? "").toString().trim();
  const jurisdictionCode = pin ? pin.substring(0, 1) : "";
  const jurisdiction = jurisdictionCode ? makeTag(jurisdictionCode) : null;

  const rows = [
    { label: "Jurisdiction", value: jurisdiction },
    { label: "Folio", value: attrs.FOLIO_NUMB?.toString() ?? null },
    { label: "PIN", value: pin || null },
    { label: "Owner", value: (attrs.OWNER ?? "").toString().trim() || null },
    { label: "Mailing Address", value: formatMailingAddress(attrs) },
    { label: "Site Address", value: formatSiteAddress(attrs) },
    { label: "SEC-TWN-RNG", value: deriveSecTwnRngFromPin(pin) },
    { label: "Acreage", value: attrs.ACREAGE?.toString() ?? null },
    { label: "Market Value", value: formatMoney(attrs.MARKET_VAL) },
    {
      label: "Landuse Code",
      value: [attrs.DOR_CODE, attrs.LU_GRP].filter(Boolean).join(" ").trim() || null
    }
  ];

  // Remove empty rows
  return rows.filter((r) => r.value !== null && r.value !== "");
}
