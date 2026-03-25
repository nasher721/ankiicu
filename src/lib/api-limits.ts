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

/** Chunk size when loading every card for export (avoids Prisma take caps). */
export const EXPORT_FETCH_BATCH = 2000;

/**
 * Vercel serverless request bodies are capped (~4.5 MB including multipart framing).
 * Use a conservative file cap so the request stays under the platform limit.
 */
const VERCEL_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Default when not on Vercel (Docker, local Postgres, etc.). */
const SELF_HOST_DEFAULT_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Upper bound for MAX_UPLOAD_BYTES env override on self-hosted runs. */
const ENV_UPLOAD_HARD_CAP = 50 * 1024 * 1024;

function parseEnvUploadBytes(): number | null {
  const raw = process.env.MAX_UPLOAD_BYTES;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Max upload size (raw file bytes). Decoded PDF text must also fit this cap.
 * - On Vercel: defaults to 4 MiB (under the ~4.5 MB request limit).
 * - Elsewhere: defaults to 15 MiB.
 * - Set MAX_UPLOAD_BYTES in env to override (clamped on Vercel to the platform cap).
 */
export const MAX_UPLOAD_BYTES: number = (() => {
  const fromEnv = parseEnvUploadBytes();
  const onVercel = Boolean(process.env.VERCEL);
  if (onVercel) {
    if (fromEnv != null) {
      return Math.min(fromEnv, VERCEL_MAX_UPLOAD_BYTES);
    }
    return VERCEL_MAX_UPLOAD_BYTES;
  }
  if (fromEnv != null) {
    return Math.min(fromEnv, ENV_UPLOAD_HARD_CAP);
  }
  return SELF_HOST_DEFAULT_UPLOAD_BYTES;
})();

export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}
