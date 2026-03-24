/** Upload: max decoded text size (bytes). */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** AI generation: questions per request (server-enforced). */
export const MAX_QUESTION_COUNT = 20;
export const MIN_QUESTION_COUNT = 1;

/** Progress batch size bounds. */
export const MAX_BATCH_SIZE = 50;
export const MIN_BATCH_SIZE = 1;

/** Bulk card POST body. */
export const MAX_CARDS_PER_REQUEST = 500;

/** List/export pagination defaults and caps. */
export const DEFAULT_LIST_LIMIT = 2000;
export const MAX_LIST_LIMIT = 10000;

export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}
