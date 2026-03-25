"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Target,
  Brain,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Loader2,
  Activity
} from "lucide-react";
import Link from "next/link";

interface SourceChapter {
  id: number;
  label: string;
  questionCount?: number;
}

interface GenerationProgress {
  id: string;
  currentChapterId: number;
  currentQuestionNumber: number;
  totalCardsGenerated: number;
  totalQuestionsTarget: number;
  status: "idle" | "running" | "paused" | "completed";
  batchSize: number;
  cardType: string;
  extras: string[];
  includedChapterIds: number[] | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ActivityEvent {
  id: string;
  type: "info" | "success" | "error" | "warning";
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

const CARD_TYPES = [
  { id: "cloze", label: "Cloze deletion", desc: "Fill-in-the-blank format. Best for spaced repetition." },
  { id: "basic", label: "Basic Q&A", desc: "Question on front, answer on back. Good for concepts." },
  { id: "both", label: "Both formats", desc: "Generate both formats for maximum coverage." },
];

const EXTRAS = [
  { id: "explanation", label: "Mechanism explanation", description: "Why the answer is correct" },
  { id: "mnemonic", label: "Mnemonic", description: "Memory aids for difficult concepts" },
  { id: "clinical", label: "Clinical pearl", description: "Bedside insights and practical tips" },
  { id: "resources", label: "Key references", description: "Studies and guidelines cited" },
  { id: "ddx", label: "Pitfall analysis", description: "Common mistakes and wrong answer explanations" },
];

export default function GeneratePage() {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSequentialRunning, setIsSequentialRunning] = useState(false);
  const [cardType, setCardType] = useState("cloze");
  const [extras, setExtras] = useState<string[]>(["explanation"]);
  const [batchSize, setBatchSize] = useState(5);
  const [autoContinue, setAutoContinue] = useState(true);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [hasSourceFile, setHasSourceFile] = useState(false);
  const [sourceChapters, setSourceChapters] = useState<SourceChapter[]>([]);
  const [includedChapterIds, setIncludedChapterIds] = useState<number[]>([]);
  const chapterSelectionTouchedRef = useRef(false);
  const lastSourceFileIdRef = useRef<string | null>(null);
  const sequentialIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch progress and check for source file
  const fetchData = useCallback(async () => {
    try {
      const [progressRes, uploadRes] = await Promise.all([
        fetch("/api/progress"),
        fetch("/api/upload"),
      ]);
      
      const progressData = await progressRes.json();
      const uploadData = await uploadRes.json();

      const prog = progressData.progress as GenerationProgress | null;
      setProgress(prog);
      setHasSourceFile(!!uploadData.file);

      const file = uploadData.file as { id?: string; chapters?: SourceChapter[] } | null;
      if (file?.id !== lastSourceFileIdRef.current) {
        lastSourceFileIdRef.current = file?.id ?? null;
        chapterSelectionTouchedRef.current = false;
      }

      if (file?.chapters?.length) {
        setSourceChapters(file.chapters);
        if (!chapterSelectionTouchedRef.current) {
          const inc = prog?.includedChapterIds;
          const allIds = file.chapters.map((c) => c.id);
          if (inc == null || !Array.isArray(inc) || inc.length === 0) {
            setIncludedChapterIds(allIds);
          } else {
            const valid = inc.filter((id: number) => allIds.includes(id));
            setIncludedChapterIds(valid.length > 0 ? valid : allIds);
          }
        }
      } else {
        setSourceChapters([]);
      }

      if (prog) {
        setCardType(prog.cardType || "cloze");
        setExtras(prog.extras || ["explanation"]);
        setBatchSize(prog.batchSize || 5);
        setIsSequentialRunning(prog.status === "running");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (sequentialIntervalRef.current) {
        clearInterval(sequentialIntervalRef.current);
      }
    };
  }, []);

  const addActivity = useCallback((type: ActivityEvent["type"], message: string, metadata?: Record<string, any>) => {
    setActivityLog(prev => [
      {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date(),
        metadata,
      },
      ...prev.slice(0, 49), // Keep last 50 events
    ]);
  }, []);

  const updateProgressSettings = useCallback(async () => {
    await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize, cardType, extras }),
    });
  }, [batchSize, cardType, extras]);

  const setCurrentChapter = useCallback(
    async (chapterId: number) => {
      try {
        await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentChapterId: chapterId }),
        });
        toast({ title: "Current chapter updated" });
        await fetchData();
      } catch {
        toast({ title: "Could not update chapter", variant: "destructive" });
      }
    },
    [fetchData],
  );

  const toggleChapterIncluded = useCallback((id: number, checked: boolean) => {
    chapterSelectionTouchedRef.current = true;
    setIncludedChapterIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id].sort((a, b) => a - b);
      return prev.filter((x) => x !== id);
    });
  }, []);

  const selectAllChapters = useCallback(() => {
    chapterSelectionTouchedRef.current = true;
    setIncludedChapterIds(sourceChapters.map((c) => c.id));
  }, [sourceChapters]);

  const clearChapterCheckboxes = useCallback(() => {
    chapterSelectionTouchedRef.current = true;
    setIncludedChapterIds([]);
  }, []);

  const applyChapterScope = useCallback(async () => {
    if (sourceChapters.length === 0) return;
    if (includedChapterIds.length === 0) {
      toast({
        title: "Select at least one chapter",
        description: "Check the boxes for chapters you want in Generate All.",
        variant: "destructive",
      });
      return;
    }
    const allIds = sourceChapters.map((c) => c.id).sort((a, b) => a - b);
    const sortedSel = [...includedChapterIds].sort((a, b) => a - b);
    const isAll =
      sortedSel.length === allIds.length && sortedSel.every((id, i) => id === allIds[i]);
    try {
      await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includedChapterIds: isAll ? null : includedChapterIds,
        }),
      });
      chapterSelectionTouchedRef.current = false;
      toast({ title: "Chapter scope saved" });
      await fetchData();
    } catch {
      toast({ title: "Could not save chapter scope", variant: "destructive" });
    }
  }, [sourceChapters, includedChapterIds, fetchData]);

  const generateSingleBatch = useCallback(async () => {
    if (!hasSourceFile) {
      toast({ 
        title: "No source file", 
        description: "Please upload a textbook first.", 
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);
    addActivity("info", `Starting batch generation (${batchSize} cards)...`);
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          cardType,
          extras,
          questionCount: batchSize,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        addActivity("success", `Generated ${data.savedCount} cards`, { 
          generated: data.savedCount,
          chapter: data.cards?.[0]?.chapter 
        });
        toast({ title: "Success!", description: `${data.savedCount} cards generated` });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      addActivity("error", `Generation failed: ${message}`);
      toast({ title: "Generation failed", description: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [hasSourceFile, batchSize, cardType, extras, addActivity, fetchData]);

  const startSequentialGeneration = useCallback(async () => {
    if (!hasSourceFile) {
      toast({ 
        title: "No source file", 
        description: "Please upload a textbook first.", 
        variant: "destructive" 
      });
      return;
    }

    await updateProgressSettings();
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });

    setIsSequentialRunning(true);
    addActivity("info", "Sequential generation started");

    // Run first batch
    const runBatch = async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "batch",
            cardType,
            extras,
            questionCount: batchSize,
          }),
        });

        const data = await res.json();
        
        if (data.success) {
          addActivity("success", `Batch complete: ${data.savedCount} cards`, {
            generated: data.savedCount,
            totalGenerated: data.progress?.totalCardsGenerated,
          });
          fetchData();
          
          if (data.progress?.status === "completed") {
            addActivity("success", "All chapters completed!");
            setIsSequentialRunning(false);
            toast({ title: "Complete!", description: "All chapters have been processed" });
            return true;
          }
        } else {
          throw new Error(data.error);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        addActivity("error", `Batch failed: ${message}`);
        setIsSequentialRunning(false);
        return true; // Stop on error
      }
      return false;
    };

    const completed = await runBatch();
    
    if (!completed && autoContinue) {
      sequentialIntervalRef.current = setInterval(async () => {
        const currentProgress = await fetch("/api/progress").then(r => r.json());
        if (currentProgress.progress?.status === "completed" || currentProgress.progress?.status === "paused") {
          if (sequentialIntervalRef.current) {
            clearInterval(sequentialIntervalRef.current);
          }
          setIsSequentialRunning(false);
          return;
        }
        await runBatch();
      }, 30000);
    }
  }, [hasSourceFile, cardType, extras, batchSize, autoContinue, addActivity, fetchData, updateProgressSettings]);

  const stopSequentialGeneration = useCallback(async () => {
    setIsSequentialRunning(false);
    if (sequentialIntervalRef.current) {
      clearInterval(sequentialIntervalRef.current);
      sequentialIntervalRef.current = null;
    }
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pause" }),
    });
    addActivity("warning", "Generation paused by user");
    fetchData();
  }, [addActivity, fetchData]);

  const resetProgress = useCallback(async () => {
    if (!confirm("Reset all progress? This will clear the generation position but keep your cards.")) return;
    
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    addActivity("info", "Progress reset");
    fetchData();
    toast({ title: "Progress reset" });
  }, [addActivity, fetchData]);

  const progressPercent = progress && progress.totalQuestionsTarget > 0
    ? Math.min(100, Math.round((progress.totalCardsGenerated / progress.totalQuestionsTarget) * 100))
    : 0;

  const estimatedTimeRemaining = progress && progress.totalCardsGenerated > 0 && isSequentialRunning
    ? Math.ceil(((progress.totalQuestionsTarget - progress.totalCardsGenerated) / batchSize) * 0.5)
    : null;

  if (!hasSourceFile) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Cards</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered card generation from your textbook content.
          </p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Source File</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Upload a textbook file first to start generating Anki cards.
                </p>
              </div>
              <Button asChild>
                <Link href="/upload">
                  Upload Textbook
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generate Cards</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered card generation from your textbook content.
          </p>
        </div>
        {progress && (
          <Badge 
            variant={progress.status === "running" ? "default" : progress.status === "completed" ? "secondary" : "outline"}
            className="text-sm"
          >
            {progress.status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {progress.status === "completed" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
          </Badge>
        )}
      </div>

      {sourceChapters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Chapters
            </CardTitle>
            <CardDescription>
              Click a row to set the current chapter (used for Generate N). Use checkboxes and Apply scope
              to limit which chapters Generate All runs through.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllChapters}
                disabled={isSequentialRunning}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearChapterCheckboxes}
                disabled={isSequentialRunning}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={applyChapterScope}
                disabled={isSequentialRunning || isGenerating}
              >
                Apply scope
              </Button>
            </div>
            <ScrollArea className="h-80 rounded-md border pr-2">
              <div className="space-y-1 p-2">
                {sourceChapters.map((ch) => {
                  const isCurrent = progress?.currentChapterId === ch.id;
                  const checked = includedChapterIds.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                        isCurrent
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-secondary/40 hover:bg-secondary/70",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isSequentialRunning}
                        onCheckedChange={(v) => toggleChapterIncluded(ch.id, v === true)}
                        aria-label={`Include chapter ${ch.id} in Generate All`}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left disabled:opacity-50"
                        onClick={() => void setCurrentChapter(ch.id)}
                        disabled={isSequentialRunning}
                      >
                        <p className="truncate font-medium">{ch.label}</p>
                        <p className="text-xs text-muted-foreground">
                          ~{ch.questionCount ?? 0} questions detected · Click to set as current
                        </p>
                      </button>
                      {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Generation Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{progress?.totalCardsGenerated || 0}</p>
                  <p className="text-xs text-muted-foreground">Cards Generated</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{progress?.totalQuestionsTarget || 0}</p>
                  <p className="text-xs text-muted-foreground">Target Questions</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{progress?.currentChapterId || 1}</p>
                  <p className="text-xs text-muted-foreground">Current Chapter</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{progressPercent}%</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
                {estimatedTimeRemaining && (
                  <p className="text-xs text-muted-foreground">
                    Estimated time remaining: ~{estimatedTimeRemaining} minutes
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  size="lg"
                  onClick={isSequentialRunning ? stopSequentialGeneration : startSequentialGeneration}
                  disabled={isGenerating || progress?.status === "completed"}
                  className="flex-1"
                >
                  {isSequentialRunning ? (
                    <><Pause className="h-5 w-5 mr-2" /> Pause Generation</>
                  ) : (
                    <><Play className="h-5 w-5 mr-2" /> Generate All</>
                  )}
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={generateSingleBatch}
                  disabled={isGenerating || isSequentialRunning}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><Zap className="h-5 w-5 mr-2" /> Generate {batchSize}</>
                  )}
                </Button>
                <Button 
                  size="lg"
                  variant="ghost"
                  onClick={resetProgress}
                  disabled={isGenerating || isSequentialRunning}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>

              {/* Auto-continue Toggle */}
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="auto-continue" className="text-sm cursor-pointer">
                    Auto-continue (30s intervals)
                  </Label>
                </div>
                <Switch
                  id="auto-continue"
                  checked={autoContinue}
                  onCheckedChange={setAutoContinue}
                  disabled={isSequentialRunning}
                />
              </div>

              {/* Error Display */}
              {progress?.lastError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {progress.lastError}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>Configure how cards are generated</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Card Type */}
              <div className="space-y-3">
                <Label>Card Format</Label>
                <div className="grid gap-2">
                  {CARD_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => !isSequentialRunning && setCardType(type.id)}
                      disabled={isSequentialRunning}
                      className={cn(
                        "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                        cardType === type.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                        isSequentialRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center",
                        cardType === type.id ? "border-primary" : "border-muted-foreground"
                      )}>
                        {cardType === type.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium">{type.label}</p>
                        <p className="text-sm text-muted-foreground">{type.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Extra Fields */}
              <div className="space-y-3">
                <Label>Extra Fields</Label>
                <div className="grid gap-2">
                  {EXTRAS.map((extra) => (
                    <div
                      key={extra.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
                        extras.includes(extra.id)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                        isSequentialRunning && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => !isSequentialRunning && toggleExtra(extra.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                          extras.includes(extra.id) ? "bg-primary border-primary" : "border-muted-foreground"
                        )}>
                          {extras.includes(extra.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{extra.label}</p>
                          <p className="text-xs text-muted-foreground">{extra.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Batch Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Cards per Batch</Label>
                  <span className="text-sm font-medium">{batchSize}</span>
                </div>
                <Slider
                  value={[batchSize]}
                  onValueChange={([v]) => setBatchSize(v)}
                  min={1}
                  max={15}
                  step={1}
                  disabled={isSequentialRunning}
                />
                <p className="text-xs text-muted-foreground">
                  Smaller batches are more reliable but slower. Larger batches may timeout.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity Log */}
        <div className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Activity Log
              </CardTitle>
              <CardDescription>Real-time generation events</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {activityLog.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No activity yet.</p>
                      <p className="text-xs">Start generation to see events.</p>
                    </div>
                  ) : (
                    activityLog.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 text-sm"
                      >
                        <ActivityIcon type={event.type} />
                        <div className="flex-1 min-w-0">
                          <p className="break-words">{event.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {event.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  function toggleExtra(id: string) {
    setExtras(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }
}

function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  const icons = {
    info: <Clock className="h-4 w-4 text-blue-500 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />,
    error: <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />,
  };
  return icons[type];
}
