export function safeJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (raw == null || raw === "") return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}
