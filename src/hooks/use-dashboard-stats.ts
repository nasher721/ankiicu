"use client";

import { useState, useEffect, useCallback } from "react";
import { cardsApiUrl } from "@/lib/api-config";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CardEntry {
  id: string;
  chapter: string;
  difficulty: string;
  createdAt: string;
}

export interface GenerationProgress {
  status: string;
  currentChapterId: number;
  totalCardsGenerated: number;
  totalQuestionsTarget: number;
}

export interface SourceFile {
  filename: string;
  totalQuestions: number;
  chapters: { id: number; label: string; questionCount: number }[];
}

export interface RecentActivity {
  type: string;
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  totalCards: number;
  cardsByChapter: { chapter: string; count: number }[];
  cardsByDifficulty: { difficulty: string; count: number }[];
  generationProgress: GenerationProgress | null;
  sourceFile: SourceFile | null;
  recentActivity: RecentActivity[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRecentActivity(
  cards: CardEntry[],
  progress: { sourceFile?: { filename?: string; createdAt?: string } } | null,
): RecentActivity[] {
  const activities: RecentActivity[] = [];

  if (cards.length > 0) {
    activities.push({
      type: "generated",
      description: `Generated ${cards.length} cards`,
      timestamp: cards[0].createdAt,
    });
  }

  if (progress?.sourceFile) {
    activities.push({
      type: "uploaded",
      description: `Uploaded ${progress.sourceFile.filename ?? "file"}`,
      timestamp: progress.sourceFile.createdAt ?? new Date().toISOString(),
    });
  }

  return activities.slice(0, 5);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches dashboard statistics and polls for updates on a configurable interval.
 * @param intervalMs - Auto-refresh interval in milliseconds (default: 30 000)
 */
export function useDashboardStats(intervalMs = 30_000) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [cardsRes, progressRes] = await Promise.all([
        fetch(cardsApiUrl),
        fetch("/api/progress"),
      ]);

      const cardsData = await cardsRes.json();
      const progressData = await progressRes.json();

      const cards: CardEntry[] = cardsData.cards ?? [];
      const totalCardsCount: number =
        typeof cardsData.total === "number" ? cardsData.total : cards.length;

      const byChapter: Record<string, number> = {};
      const byDifficulty: Record<string, number> = {};

      for (const card of cards) {
        byChapter[card.chapter] = (byChapter[card.chapter] ?? 0) + 1;
        byDifficulty[card.difficulty] = (byDifficulty[card.difficulty] ?? 0) + 1;
      }

      setStats({
        totalCards: totalCardsCount,
        cardsByChapter: Object.entries(byChapter)
          .map(([chapter, count]) => ({ chapter, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        cardsByDifficulty: Object.entries(byDifficulty).map(
          ([difficulty, count]) => ({ difficulty, count }),
        ),
        generationProgress: progressData.progress ?? null,
        sourceFile: progressData.sourceFile ?? null,
        recentActivity: buildRecentActivity(cards, progressData.progress),
      });
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, intervalMs);
    return () => clearInterval(interval);
  }, [fetchStats, intervalMs]);

  return { stats, loading, refresh: fetchStats };
}
