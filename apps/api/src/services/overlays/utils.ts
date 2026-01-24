/**
 * Get attribute value case-insensitively.
 * Tries exact match first, then lowercase match.
 * Handles field name differences between MapServer (uppercase) and FeatureServer (lowercase).
 */
export function getAttr(a: Record<string, any>, key: string): unknown {
  if (a[key] !== undefined) return a[key];
  const lowerKey = key.toLowerCase();
  if (a[lowerKey] !== undefined) return a[lowerKey];
  // Also try with underscores for SHAPE__Area style fields
  for (const k of Object.keys(a)) {
    if (k.toLowerCase() === lowerKey) return a[k];
  }
  return undefined;
}

/**
 * Get string attribute, trimmed and empty-string checked.
 * Returns undefined if empty or whitespace only.
 */
export function getStringAttr(a: Record<string, any>, key: string): string | undefined {
  const v = getAttr(a, key);
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s && s !== " " ? s : undefined;
}
