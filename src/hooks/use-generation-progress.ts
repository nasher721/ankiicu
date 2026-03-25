"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GenerationProgressState {
  id: string;
  status: string;
  currentChapterId: number;
  currentQuestionNumber: number;
  totalCardsGenerated: number;
  totalQuestionsTarget: number;
  batchSize: number | null;
  cardType: string | null;
  extras: string[];
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastRunAt: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Polls the /api/progress endpoint for the current generation progress.
 * Automatically stops polling when status is "completed" or "idle".
 * @param intervalMs - Polling interval in milliseconds (default: 5 000)
 */
export function useGenerationProgress(intervalMs = 5_000) {
  const [progress, setProgress] = useState<GenerationProgressState | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/progress");
      const data = await res.json();
      const next: GenerationProgressState | null = data.progress ?? null;
      setProgress(next);

      // Stop polling when generation is no longer active
      if (
        next?.status === "completed" ||
        next?.status === "idle" ||
        next === null
      ) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Failed to fetch generation progress:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Manually restart polling (e.g. after the user starts a new generation) */
  const startPolling = useCallback(() => {
    if (intervalRef.current) return; // already polling
    intervalRef.current = setInterval(fetchProgress, intervalMs);
  }, [fetchProgress, intervalMs]);

  useEffect(() => {
    fetchProgress();
    intervalRef.current = setInterval(fetchProgress, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchProgress, intervalMs]);

  return { progress, loading, startPolling, refresh: fetchProgress };
}
