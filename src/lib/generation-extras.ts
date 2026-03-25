import { safeJsonArray } from "@/lib/json-safe";

/** Extra field ids sent to `/api/generate` and stored on `GenerationProgress.extras`. */
export const ALL_GENERATION_EXTRA_IDS: string[] = [
  "explanation",
  "mnemonic",
  "clinical",
  "resources",
  "differential",
  "pitfalls",
];

/**
 * Legacy extra id `ddx` toggled pitfall/distractor analysis only.
 * It is normalized to `pitfalls`. New differential content uses extra id `differential`.
 */
export function migrateLegacyGenerationExtraIds(extras: string[]): string[] {
  const mapped = extras.map((id) => (id === "ddx" ? "pitfalls" : id));
  return [...new Set(mapped)];
}

/**
 * Extras read from DB. Empty arrays normalize to ALL_GENERATION_EXTRA_IDS
 * so new or reset progress still requests every extra field.
 */
export function extrasFromStoredProgress(raw: string | null | undefined): string[] {
  const migrated = migrateLegacyGenerationExtraIds(safeJsonArray(raw, []));
  return migrated.length > 0 ? migrated : [...ALL_GENERATION_EXTRA_IDS];
}

export function resolveExtrasForGeneration(
  overrideExtras: string[] | undefined | null,
  progressExtrasRaw: string | null | undefined,
): string[] {
  if (overrideExtras != null) {
    const m = migrateLegacyGenerationExtraIds(overrideExtras);
    return m.length > 0 ? m : [...ALL_GENERATION_EXTRA_IDS];
  }
  return extrasFromStoredProgress(progressExtrasRaw);
}
