import { safeJsonArray } from "@/lib/json-safe";

/**
 * Legacy extra id `ddx` toggled pitfall/distractor analysis only.
 * It is normalized to `pitfalls`. New differential content uses extra id `differential`.
 */
export function migrateLegacyGenerationExtraIds(extras: string[]): string[] {
  const mapped = extras.map((id) => (id === "ddx" ? "pitfalls" : id));
  return [...new Set(mapped)];
}

export function parseProgressExtras(raw: string | null | undefined, fallback: string[]): string[] {
  return migrateLegacyGenerationExtraIds(safeJsonArray(raw, fallback));
}
