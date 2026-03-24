"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  Brain, 
  CheckCircle2, 
  Clipboard, 
  Download, 
  FileText, 
  Layers, 
  Lightbulb, 
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Target,
  MessageSquare,
  Database,
  Loader2,
  Upload,
  Trash2,
  Eye,
  Wand2,
  Play,
  Pause,
  RotateCcw,
  FileUp,
  FolderOpen,
  Clock
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface AnkiCard {
  id: string;
  cardId: string;
  chapter: string;
  chapterId?: number;
  sourceQNumber: number;
  difficulty: string;
  tags: string;
  ankiType: string;
  clozeText: string | null;
  front: string | null;
  back: string | null;
  explanation: string | null;
  mnemonic: string | null;
  clinicalPearl: string | null;
  references: string | null;
  pitfalls: string | null;
  imageDependent: boolean;
  seeAlso: string | null;
  rawJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SourceFile {
  id: string;
  filename: string;
  fileType: string;
  chapters: Chapter[];
  totalQuestions: number;
  processed: boolean;
  createdAt: string;
}

interface Chapter {
  id: number;
  label: string;
  startIdx: number;
  endIdx: number;
  questionCount: number;
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
  lastError: string | null;
  sourceFileId: string | null;
  startedAt: string | null;
  lastRunAt: string | null;
  completedAt: string | null;
}

// ─── DEFAULT CHAPTERS (fallback) ────────────────────────────────────────────────

const DEFAULT_CHAPTERS: Chapter[] = [
  { id: 1, label: "CNS Ischemia and Hemorrhage", startIdx: 0, endIdx: 0, questionCount: 42 },
  { id: 2, label: "Subarachnoid Hemorrhage and Vascular Malformations", startIdx: 0, endIdx: 0, questionCount: 38 },
  { id: 3, label: "Intracerebral Hemorrhage", startIdx: 0, endIdx: 0, questionCount: 30 },
  { id: 4, label: "Traumatic Brain Injury", startIdx: 0, endIdx: 0, questionCount: 35 },
  { id: 5, label: "Neuromuscular Disorders", startIdx: 0, endIdx: 0, questionCount: 28 },
  { id: 6, label: "Status Epilepticus and Seizures", startIdx: 0, endIdx: 0, questionCount: 32 },
  { id: 7, label: "CNS Infections", startIdx: 0, endIdx: 0, questionCount: 26 },
  { id: 8, label: "Autoimmune and Inflammatory Disorders", startIdx: 0, endIdx: 0, questionCount: 22 },
  { id: 9, label: "Spinal Cord Disorders", startIdx: 0, endIdx: 0, questionCount: 18 },
  { id: 10, label: "Brain Tumors and Metastases", startIdx: 0, endIdx: 0, questionCount: 20 },
  { id: 11, label: "Neurotoxicology", startIdx: 0, endIdx: 0, questionCount: 16 },
  { id: 12, label: "Neuro-Ophthalmology", startIdx: 0, endIdx: 0, questionCount: 18 },
  { id: 13, label: "Neurological Complications of Cardiac Disease", startIdx: 0, endIdx: 0, questionCount: 22 },
  { id: 14, label: "Neurological Complications of Systemic Disease", startIdx: 0, endIdx: 0, questionCount: 24 },
  { id: 15, label: "Pharmacology and Sedation", startIdx: 0, endIdx: 0, questionCount: 30 },
  { id: 16, label: "Cardiovascular Disorders", startIdx: 0, endIdx: 0, questionCount: 26 },
  { id: 17, label: "Respiratory Disorders", startIdx: 0, endIdx: 0, questionCount: 24 },
  { id: 18, label: "Renal Disorders", startIdx: 0, endIdx: 0, questionCount: 20 },
  { id: 19, label: "Endocrine Disorders", startIdx: 0, endIdx: 0, questionCount: 22 },
  { id: 20, label: "Infectious Diseases", startIdx: 0, endIdx: 0, questionCount: 24 },
  { id: 21, label: "Acute Hematological Disorders", startIdx: 0, endIdx: 0, questionCount: 20 },
  { id: 22, label: "Acute GI and GU Disorders", startIdx: 0, endIdx: 0, questionCount: 18 },
  { id: 23, label: "Diagnosis of Brain Death", startIdx: 0, endIdx: 0, questionCount: 22 },
  { id: 24, label: "General Trauma and Burns", startIdx: 0, endIdx: 0, questionCount: 20 },
  { id: 25, label: "Ethical and Legal Aspects", startIdx: 0, endIdx: 0, questionCount: 16 },
  { id: 26, label: "Principles of Research", startIdx: 0, endIdx: 0, questionCount: 14 },
  { id: 27, label: "Procedural Skills and Monitoring", startIdx: 0, endIdx: 0, questionCount: 28 },
  { id: 28, label: "Clinical Cases", startIdx: 0, endIdx: 0, questionCount: 24 },
];

const CARD_TYPES = [
  { id: "cloze", label: "Cloze deletion", desc: "Best for spaced repetition" },
  { id: "basic", label: "Basic Q&A", desc: "Best for conceptual reasoning" },
  { id: "both", label: "Both formats", desc: "Maximum coverage" },
];

const EXTRAS = [
  { id: "explanation", label: "Mechanism explanation", icon: Lightbulb },
  { id: "mnemonic", label: "Mnemonic", icon: Brain },
  { id: "clinical", label: "Clinical pearl", icon: Sparkles },
  { id: "resources", label: "Key references", icon: BookOpen },
  { id: "ddx", label: "Pitfall analysis", icon: AlertTriangle },
];

// ─── SAMPLE CARDS FOR PREVIEW ──────────────────────────────────────────────────

const SAMPLE_CARDS: Record<string, {
  chapter: string;
  difficulty: string;
  tags: string[];
  cloze_text?: string;
  front?: string;
  back?: string;
  mnemonic?: string;
  clinical_pearl?: string;
  explanation?: string;
}> = {
  cloze: {
    chapter: "Intracerebral Hemorrhage",
    difficulty: "medium",
    tags: ["dabigatran", "reversal-agents", "ICH", "high-yield"],
    cloze_text: `A 76-year-old woman with atrial fibrillation presents with sudden onset left hemiparesis. CT shows a 33-mL right parietal intracerebral hemorrhage. She is taking dabigatran. What is the best treatment?

A. Fresh frozen plasma
B. Prothrombin complex concentrate
C. Idarucizumab
D. Intravenous vitamin K

The correct answer is {{c1::C}} — {{c2::Idarucizumab}}.`,
    mnemonic: "iDABIgatran → iDABIcizumab",
    clinical_pearl: "Andexanet alfa reverses factor Xa inhibitors — not dabigatran.",
    explanation: "Idarucizumab (RE-VERSE AD) completely reversed dabigatran anticoagulation in 88–98% of patients within minutes.",
  },
  basic: {
    chapter: "Cerebrovascular Disorders",
    difficulty: "medium",
    tags: ["tPA", "thrombolysis", "ECASS-III", "board-tested"],
    front: `A 60-year-old woman is found on the floor at 10am. Her son saw her walking normally at 8am. CT shows early right MCA changes. Is she eligible for tPA?

A. No — outside the 3-hour window
B. Yes — last-known-well is 8am; she qualifies for the 4.5-hour window
C. Yes — last-known-well is 10am when found
D. Cannot determine without MRI`,
    back: `<b>Answer B — Yes, last-known-well is 8am; she qualifies for the 4.5-hour window.</b>`,
    explanation: "ECASS III extended the tPA window to 4.5h.",
  },
};

// ─── CARD PREVIEW COMPONENT ──────────────────────────────────────────────────

function CardPreview({ cardType, extras }: { cardType: string; extras: string[] }) {
  const previewType = cardType === "basic" ? "basic" : "cloze";
  const card = SAMPLE_CARDS[previewType] || SAMPLE_CARDS.cloze;
  const [flipped, setFlipped] = useState(false);

  const renderCloze = (text: string, revealed: boolean) => {
    if (!text) return "";
    return text.replace(/\{\{c(\d+)::(.*?)\}\}/g, (_, num, val) => {
      if (revealed) {
        return num === "1"
          ? `<span class="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded font-medium">${val}</span>`
          : `<span class="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">${val}</span>`;
      }
      return `<span class="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-3 py-0.5 rounded font-medium tracking-widest">___</span>`;
    }).replace(/\n/g, "<br>");
  };

  const showMnemonic = extras.includes("mnemonic") && card.mnemonic;
  const showClinical = extras.includes("clinical") && card.clinical_pearl;
  const showExplanation = extras.includes("explanation") && card.explanation;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardDescription>{card.chapter}</CardDescription>
          <Badge variant="outline">{card.difficulty}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewType === "cloze" ? (
          <div 
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderCloze(card.cloze_text || "", flipped) }} 
          />
        ) : (
          <div>
            <p className="text-xs text-muted-foreground mb-2">{flipped ? "BACK" : "FRONT"}</p>
            <div 
              className="text-sm"
              dangerouslySetInnerHTML={{ __html: flipped ? card.back : renderCloze(card.front || "", false) }} 
            />
          </div>
        )}
        
        {/* Extra fields shown when flipped */}
        {flipped && (
          <div className="space-y-3 pt-3 border-t">
            {showExplanation && (
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> EXPLANATION
                </p>
                <p className="text-sm">{card.explanation}</p>
              </div>
            )}
            {showMnemonic && (
              <div>
                <p className="text-xs font-medium text-purple-600 mb-1 flex items-center gap-1">
                  <Brain className="h-3 w-3" /> MNEMONIC
                </p>
                <p className="text-sm italic">{card.mnemonic}</p>
              </div>
            )}
            {showClinical && (
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> CLINICAL PEARL
                </p>
                <p className="text-sm">{card.clinical_pearl}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <div className="px-6 pb-4 pt-2 border-t flex justify-between items-center">
        <div className="flex gap-1 flex-wrap">
          {card.tags.map(tag => (
            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
        <Button size="sm" onClick={() => setFlipped(f => !f)}>
          {flipped ? "Flip back" : "Reveal"}
        </Button>
      </div>
    </Card>
  );
}

// ─── STAT CARD COMPONENT ─────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { 
  label: string; 
  value: string | number; 
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />}
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-semibold ${color || ""}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function AnkiGenerator() {
  // File state
  const [sourceFile, setSourceFile] = useState<SourceFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generation state
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cardsCount, setCardsCount] = useState(0);
  
  // Settings
  const [cardType, setCardType] = useState("cloze");
  const [extras, setExtras] = useState<string[]>(["explanation"]);
  const [batchSize, setBatchSize] = useState(5);
  
  // Sequential generation
  const [isSequentialRunning, setIsSequentialRunning] = useState(false);
  const [autoContinue, setAutoContinue] = useState(true);
  const sequentialIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Other
  const [importJson, setImportJson] = useState("");
  const [savedCards, setSavedCards] = useState<AnkiCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<AnkiCard | null>(null);

  // Chapters from source file or defaults
  const chapters = sourceFile?.chapters || DEFAULT_CHAPTERS;
  
  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // Get progress and file info
      const progressRes = await fetch("/api/progress");
      const progressData = await progressRes.json();
      setProgress(progressData.progress);
      setCardsCount(progressData.cardsCount || 0);
      if (progressData.sourceFile) {
        setSourceFile(progressData.sourceFile);
      }
      
      // Update settings from progress
      if (progressData.progress) {
        setCardType(progressData.progress.cardType || "cloze");
        setExtras(progressData.progress.extras || ["explanation"]);
        setBatchSize(progressData.progress.batchSize || 5);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  // Fetch saved cards
  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/cards");
      const data = await res.json();
      if (data.cards) {
        setSavedCards(data.cards);
        setCardsCount(data.cards.length);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchCards();
  }, [fetchData, fetchCards]);

  // ─── FILE UPLOAD ─────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setSourceFile(data.file);
        toast({ title: "File uploaded!", description: `${data.file.filename} - ${data.file.totalQuestions} questions detected` });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [fetchData]);

  const handleDeleteFile = useCallback(async () => {
    if (!confirm("Delete uploaded file and reset progress?")) return;
    try {
      await fetch("/api/upload", { method: "DELETE" });
      setSourceFile(null);
      setProgress(null);
      toast({ title: "File deleted" });
    } catch {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  }, []);

  // ─── GENERATION FUNCTIONS ─────────────────────────────────────────────────────

  const updateProgressSettings = useCallback(async () => {
    await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize, cardType, extras }),
    });
  }, [batchSize, cardType, extras]);

  const generateSingleBatch = useCallback(async (mode: "single" | "continue" | "batch" = "single") => {
    if (!sourceFile && chapters.length === 0) {
      toast({ title: "No content", description: "Please upload a file first", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          cardType,
          extras,
          questionCount: batchSize,
          chapterIds: progress ? [progress.currentChapterId] : [chapters[0]?.id],
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast({ 
          title: "Generated!", 
          description: `${data.savedCount} cards saved` 
        });
        fetchCards();
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [sourceFile, chapters, progress, cardType, extras, batchSize, fetchCards, fetchData]);

  // ─── SEQUENTIAL GENERATION ────────────────────────────────────────────────────

  const startSequentialGeneration = useCallback(async () => {
    if (!sourceFile && chapters.length === 0) {
      toast({ title: "No content", description: "Please upload a file first", variant: "destructive" });
      return;
    }

    await updateProgressSettings();
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });

    setIsSequentialRunning(true);
    setProgress(p => p ? { ...p, status: "running" } : null);
    
    // Start generation loop
    const runBatch = async () => {
      if (!isSequentialRunning) return;
      
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
          fetchCards();
          fetchData();
          
          // Check if completed
          if (data.progress?.status === "completed") {
            stopSequentialGeneration();
            toast({ title: "Complete!", description: "All chapters processed" });
          }
        } else {
          stopSequentialGeneration();
          toast({ title: "Error", description: data.error, variant: "destructive" });
        }
      } catch (error) {
        stopSequentialGeneration();
        toast({ title: "Error", description: "Generation stopped due to error", variant: "destructive" });
      }
    };

    // Run first batch immediately
    await runBatch();
    
    // Set up interval for continuous generation
    if (autoContinue) {
      sequentialIntervalRef.current = setInterval(async () => {
        const currentProgress = await fetch("/api/progress").then(r => r.json());
        if (currentProgress.progress?.status === "completed" || currentProgress.progress?.status === "paused") {
          stopSequentialGeneration();
          return;
        }
        await runBatch();
      }, 30000); // 30 second intervals between batches
    }
  }, [sourceFile, chapters, cardType, extras, batchSize, autoContinue, fetchCards, fetchData, isSequentialRunning]);

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
    fetchData();
  }, [fetchData]);

  const resetProgress = useCallback(async () => {
    if (!confirm("Reset progress? This will clear the generation position.")) return;
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    fetchData();
    toast({ title: "Progress reset" });
  }, [fetchData]);

  // ─── IMPORT/EXPORT ────────────────────────────────────────────────────────────

  const importCards = useCallback(async () => {
    if (!importJson.trim()) {
      toast({ title: "Error", description: "Please paste JSON to import", variant: "destructive" });
      return;
    }

    try {
      const parsed = JSON.parse(importJson);
      const cards = Array.isArray(parsed) ? parsed : [parsed];
      
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      
      const data = await res.json();
      if (data.success) {
        toast({ title: "Imported!", description: `${data.count} cards imported` });
        setImportJson("");
        fetchCards();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ title: "Import failed", description: "Invalid JSON format", variant: "destructive" });
    }
  }, [importJson, fetchCards]);

  const exportCards = useCallback(async (format: "json" | "csv") => {
    try {
      const res = await fetch(`/api/export?format=${format}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `neurocritical_care_anki.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported!", description: `Cards exported as ${format.toUpperCase()}` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }, []);

  const deleteAllCards = useCallback(async () => {
    if (!confirm("Delete all saved cards?")) return;
    await fetch("/api/cards", { method: "DELETE" });
    setSavedCards([]);
    setCardsCount(0);
    toast({ title: "Cards deleted" });
  }, []);

  // ─── PROGRESS CALCULATION ─────────────────────────────────────────────────────

  const progressPercent = progress && progress.totalQuestionsTarget > 0
    ? Math.min(100, Math.round((progress.totalCardsGenerated / progress.totalQuestionsTarget) * 100))
    : 0;

  const currentChapterLabel = progress && chapters.length > 0
    ? chapters.find(c => c.id === progress.currentChapterId)?.label || `Chapter ${progress.currentChapterId}`
    : "Not started";

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Anki Card Generator</h1>
          </div>
          <p className="text-muted-foreground">
            Upload your textbook, configure settings, and generate Anki flashcards with AI
          </p>
        </div>

        <Tabs defaultValue="generate" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-lg">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Cards Generated" value={progress?.totalCardsGenerated || 0} icon={Layers} color="text-primary" />
              <StatCard label="Total Questions" value={progress?.totalQuestionsTarget || sourceFile?.totalQuestions || "~650"} icon={BookOpen} />
              <StatCard label="Current Chapter" value={progress?.currentChapterId || 1} icon={Target} />
              <StatCard label="Saved Cards" value={cardsCount} icon={Database} />
            </div>

            {/* Progress Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Progress value={progressPercent} className="w-32 h-2" />
                    <span className="text-sm font-medium">{progressPercent}%</span>
                  </div>
                  <Badge variant={progress?.status === "completed" ? "default" : progress?.status === "running" ? "secondary" : "outline"}>
                    {progress?.status || "idle"}
                  </Badge>
                </div>
                <CardDescription>
                  {progress?.status === "completed" 
                    ? "All chapters processed!" 
                    : `Currently: ${currentChapterLabel} (Question ${progress?.currentQuestionNumber || 0})`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sequential Generation Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={isSequentialRunning ? stopSequentialGeneration : startSequentialGeneration}
                    disabled={isGenerating || progress?.status === "completed"}
                  >
                    {isSequentialRunning ? (
                      <>
                        <Pause className="h-5 w-5 mr-2" />
                        Pause Generation
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        Generate All ({batchSize}/batch)
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="w-full"
                    onClick={() => generateSingleBatch("single")}
                    disabled={isGenerating || isSequentialRunning}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate {batchSize} Cards
                      </>
                    )}
                  </Button>
                </div>

                {/* Quick Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoContinue"
                      checked={autoContinue}
                      onChange={(e) => setAutoContinue(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="autoContinue" className="text-sm text-muted-foreground">
                      Auto-continue (30s intervals)
                    </label>
                  </div>
                  <Button size="sm" variant="ghost" onClick={resetProgress}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset Progress
                  </Button>
                </div>

                {/* Error Display */}
                {progress?.lastError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      {progress.lastError}
                    </p>
                  </div>
                )}

                {/* Batch Size Setting */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cards per Batch</label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[batchSize]}
                      onValueChange={([v]) => setBatchSize(v)}
                      min={1}
                      max={15}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{batchSize}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Smaller batches = more reliable generation
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Current Status */}
            {progress?.startedAt && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Started: {new Date(progress.startedAt).toLocaleString()}
                    </div>
                    {progress.completedAt && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Completed: {new Date(progress.completedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Upload Source File
                </CardTitle>
                <CardDescription>
                  Upload a PDF (as extracted text) or Markdown file containing your textbook content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceFile ? (
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-green-700 dark:text-green-300">{sourceFile.filename}</span>
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          {chapters.length} chapters detected · ~{sourceFile.totalQuestions} questions
                        </p>
                        <p className="text-xs text-green-500 mt-1">
                          Uploaded: {new Date(sourceFile.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" onClick={handleDeleteFile}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">Uploading and analyzing...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FolderOpen className="h-10 w-10 text-muted-foreground" />
                        <p className="font-medium">Click to upload or drag & drop</p>
                        <p className="text-sm text-muted-foreground">PDF (extracted text), Markdown, or Text files</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".md,.txt,.pdf"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}

                {/* Detected Chapters */}
                {chapters.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Detected Chapters</p>
                    <ScrollArea className="h-[300px] border rounded-lg p-3">
                      <div className="space-y-1">
                        {chapters.map(ch => (
                          <div 
                            key={ch.id}
                            className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
                          >
                            <span className="truncate">{ch.id}. {ch.label}</span>
                            <Badge variant="outline" className="text-xs">~{ch.questionCount}q</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Preview card format with current settings
            </p>
            <CardPreview cardType={cardType} extras={extras} />
          </TabsContent>

          {/* Cards Tab */}
          <TabsContent value="cards" className="space-y-4">
            {/* Import Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Import Cards</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Paste JSON array of cards..."
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="min-h-[120px] font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Button onClick={importCards} disabled={!importJson.trim()}>Import</Button>
                  <Button variant="outline" onClick={() => setImportJson("")}>Clear</Button>
                </div>
              </CardContent>
            </Card>

            {/* Saved Cards */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Saved Cards ({cardsCount})</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => exportCards("json")} disabled={cardsCount === 0}>
                      <Download className="h-4 w-4 mr-1" />JSON
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportCards("csv")} disabled={cardsCount === 0}>
                      <Download className="h-4 w-4 mr-1" />CSV
                    </Button>
                    <Button size="sm" variant="destructive" onClick={deleteAllCards} disabled={cardsCount === 0}>
                      <Trash2 className="h-4 w-4 mr-1" />Delete All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {savedCards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No cards saved yet.</p>
                    <p className="text-sm">Use the Generate tab to create cards.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-4">
                      {savedCards.map((card) => (
                        <div 
                          key={card.id}
                          className="p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80"
                          onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{card.cardId}</p>
                              <p className="text-xs text-muted-foreground truncate">{card.chapter}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Badge variant="outline">{card.difficulty}</Badge>
                              <Badge variant="outline">{card.ankiType}</Badge>
                            </div>
                          </div>
                          {selectedCard?.id === card.id && card.clozeText && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-mono whitespace-pre-wrap">{card.clozeText.slice(0, 300)}...</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Card Format</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {CARD_TYPES.map(ct => (
                  <Button
                    key={ct.id}
                    variant={cardType === ct.id ? "default" : "outline"}
                    onClick={() => setCardType(ct.id)}
                    className="w-full justify-start"
                  >
                    <div>
                      <div className="font-medium">{ct.label}</div>
                      <div className="text-xs text-muted-foreground font-normal">{ct.desc}</div>
                    </div>
                    {cardType === ct.id && <Check className="h-4 w-4 ml-auto" />}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Extra Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {EXTRAS.map(ex => {
                  const sel = extras.includes(ex.id);
                  const Icon = ex.icon;
                  return (
                    <Button
                      key={ex.id}
                      variant={sel ? "default" : "outline"}
                      onClick={() => setExtras(prev => sel ? prev.filter(x => x !== ex.id) : [...prev, ex.id])}
                      className="w-full justify-start"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {ex.label}
                      {sel && <Check className="h-4 w-4 ml-auto" />}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            <Button onClick={updateProgressSettings} className="w-full">
              Save Settings
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
