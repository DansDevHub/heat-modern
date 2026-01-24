export function makeTag(tag: string): string {
  // Minimal subset for “Jurisdiction” used by createSiteInfo
  // (mirrors the legacy makeTag switch) :contentReference[oaicite:3]{index=3}
  switch (tag) {
    case "U":
      return "Unincorporated County";
    case "A":
      return "City of Tampa";
    case "P":
      return "Plant City";
    case "T":
      return "City of Temple Terrace";
    default:
      return tag; // fall back to raw code
  }
}
