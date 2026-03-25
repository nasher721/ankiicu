"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  Layers, 
  Target, 
  Clock,
  Zap,
  ArrowRight,
  FileText,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Download
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardsApiUrl } from "@/lib/api-config";

interface DashboardStats {
  totalCards: number;
  cardsByChapter: { chapter: string; count: number }[];
  cardsByDifficulty: { difficulty: string; count: number }[];
  generationProgress: {
    status: string;
    currentChapterId: number;
    totalCardsGenerated: number;
    totalQuestionsTarget: number;
  } | null;
  sourceFile: {
    filename: string;
    totalQuestions: number;
    chapters: { id: number; label: string; questionCount: number }[];
  } | null;
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500",
  medium: "bg-yellow-500",
  hard: "bg-red-500",
};

export default function DashboardPage() {
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

      // Process stats
      const cards = cardsData.cards || [];
      const totalCardsCount =
        typeof cardsData.total === "number" ? cardsData.total : cards.length;
      const byChapter: Record<string, number> = {};
      const byDifficulty: Record<string, number> = {};
      
      cards.forEach((card: any) => {
        byChapter[card.chapter] = (byChapter[card.chapter] || 0) + 1;
        byDifficulty[card.difficulty] = (byDifficulty[card.difficulty] || 0) + 1;
      });

      setStats({
        totalCards: totalCardsCount,
        cardsByChapter: Object.entries(byChapter)
          .map(([chapter, count]) => ({ chapter, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        cardsByDifficulty: Object.entries(byDifficulty)
          .map(([difficulty, count]) => ({ difficulty, count })),
        generationProgress: progressData.progress,
        sourceFile: progressData.sourceFile,
        recentActivity: generateRecentActivity(cards, progressData.progress),
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const progressPercent = stats?.generationProgress && stats.generationProgress.totalQuestionsTarget > 0
    ? Math.min(100, Math.round((stats.generationProgress.totalCardsGenerated / stats.generationProgress.totalQuestionsTarget) * 100))
    : 0;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your card generation progress.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Cards"
          value={stats?.totalCards || 0}
          icon={Layers}
          description="Generated cards"
          trend={stats && stats.totalCards > 0 ? "+ready to export" : undefined}
        />
        <StatCard
          title="Progress"
          value={`${progressPercent}%`}
          icon={Target}
          description="Of target questions"
          trend={stats?.generationProgress?.status === "running" ? "Generating..." : undefined}
        />
        <StatCard
          title="Source Questions"
          value={stats?.sourceFile?.totalQuestions || 0}
          icon={FileText}
          description="Detected in textbook"
        />
        <StatCard
          title="Chapters"
          value={stats?.sourceFile?.chapters?.length || 0}
          icon={Brain}
          description="Available for generation"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Progress & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Generation Progress Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Generation Progress
                  </CardTitle>
                  <CardDescription>
                    {stats?.generationProgress?.status === "running" 
                      ? "Cards are being generated automatically"
                      : stats?.generationProgress?.status === "completed"
                      ? "All chapters have been processed"
                      : "Ready to start generating cards"}
                  </CardDescription>
                </div>
                <StatusBadge status={stats?.generationProgress?.status || "idle"} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {stats?.sourceFile?.chapters && stats.sourceFile.chapters.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Chapter Progress</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stats.sourceFile.chapters.slice(0, 6).map((chapter) => (
                      <ChapterProgressBar
                        key={chapter.id}
                        chapter={chapter}
                        currentId={stats.generationProgress?.currentChapterId}
                        generated={stats.generationProgress?.totalCardsGenerated}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button asChild className="flex-1">
                  <Link href="/generate">
                    <Zap className="h-4 w-4 mr-2" />
                    {stats?.generationProgress?.status === "completed" 
                      ? "Generate More" 
                      : stats?.generationProgress?.status === "running"
                      ? "View Progress"
                      : "Start Generating"}
                  </Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/upload">
                    <FileText className="h-4 w-4 mr-2" />
                    Upload New File
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Distribution */}
          {stats && stats.cardsByDifficulty.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Difficulty Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of cards by difficulty level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-32">
                  {stats.cardsByDifficulty.map(({ difficulty, count }) => {
                    const max = Math.max(...stats.cardsByDifficulty.map(d => d.count));
                    const height = max > 0 ? (count / max) * 100 : 0;
                    return (
                      <div key={difficulty} className="flex-1 flex flex-col items-center gap-2">
                        <div 
                          className={cn(
                            "w-full rounded-t-md transition-all duration-500",
                            DIFFICULTY_COLORS[difficulty] || "bg-primary"
                          )}
                          style={{ height: `${height}%`, minHeight: count > 0 ? "4px" : "0" }}
                        />
                        <span className="text-xs text-muted-foreground capitalize">{difficulty}</span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Activity & Top Chapters */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <QuickAction href="/cards" icon={Layers} label="Browse Cards" />
              <QuickAction href="/export" icon={Download} label="Export to Anki" />
              <QuickAction href="/study" icon={Brain} label="Study Preview" />
            </CardContent>
          </Card>

          {/* Top Chapters */}
          {stats && stats.cardsByChapter.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Chapters</CardTitle>
                <CardDescription>Chapters with most generated cards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.cardsByChapter.map(({ chapter, count }) => (
                    <div key={chapter} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]" title={chapter}>{chapter}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <ActivityIcon type={activity.type} />
                      <div className="flex-1">
                        <p className="text-sm">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity. Start by uploading a textbook!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  description?: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{title}</p>
            </div>
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
            <TrendingUp className="h-3 w-3" />
            <span>{trend}</span>
          </div>
        )}
        {description && !trend && (
          <p className="mt-3 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    running: { label: "Generating", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Sparkles },
    completed: { label: "Complete", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
    paused: { label: "Paused", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: AlertCircle },
    idle: { label: "Ready", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  };
  
  const config = variants[status] || variants.idle;
  const Icon = config.icon;
  
  return (
    <Badge className={cn("gap-1", config.className)} variant="secondary">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ChapterProgressBar({ 
  chapter, 
  currentId, 
  generated 
}: { 
  chapter: { id: number; label: string; questionCount: number };
  currentId?: number;
  generated?: number;
}) {
  const isCurrent = chapter.id === currentId;
  const isPast = chapter.id < (currentId || 0);
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-8 text-muted-foreground">Ch {chapter.id}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs truncate max-w-[150px]" title={chapter.label}>{chapter.label}</span>
          <span className="text-xs text-muted-foreground">~{chapter.questionCount}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full transition-all duration-500",
              isCurrent && "bg-blue-500 animate-pulse",
              isPast && "bg-green-500",
              !isCurrent && !isPast && "bg-gray-300 dark:bg-gray-700"
            )}
            style={{ width: isPast ? "100%" : isCurrent ? "50%" : "0%" }}
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Button variant="ghost" className="w-full justify-between" asChild>
      <Link href={href}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </Button>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "generated":
      return <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />;
    case "exported":
      return <Download className="h-4 w-4 text-green-500 mt-0.5" />;
    case "uploaded":
      return <FileText className="h-4 w-4 text-purple-500 mt-0.5" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />;
  }
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function generateRecentActivity(cards: any[], progress: any): { type: string; description: string; timestamp: string }[] {
  const activities: { type: string; description: string; timestamp: string }[] = [];
  
  // Add latest card generation
  if (cards.length > 0) {
    const latest = cards[0];
    activities.push({
      type: "generated",
      description: `Generated ${cards.length} cards`,
      timestamp: latest.createdAt,
    });
  }
  
  // Add file upload if available
  if (progress?.sourceFile) {
    activities.push({
      type: "uploaded",
      description: `Uploaded ${progress.sourceFile.filename}`,
      timestamp: progress.sourceFile.createdAt || new Date().toISOString(),
    });
  }
  
  return activities.slice(0, 5);
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}
