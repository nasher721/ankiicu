"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Download, 
  FileJson, 
  FileSpreadsheet, 
  Package,
  CheckCircle2,
  Clock,
  Layers,
  Filter,
  BookOpen,
  GraduationCap,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

interface ExportPreset {
  id: string;
  name: string;
  description: string;
  filters: {
    difficulty?: string[];
    chapters?: string[];
    cardTypes?: string[];
  };
}

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "all",
    name: "Complete Deck",
    description: "Export all generated cards",
    filters: {},
  },
  {
    id: "high-yield",
    name: "High Yield Only",
    description: "Cards tagged as high-yield or board-tested",
    filters: {},
  },
  {
    id: "hard",
    name: "Hard Questions",
    description: "Only hard difficulty cards for focused review",
    filters: { difficulty: ["hard"] },
  },
  {
    id: "basic-only",
    name: "Basic Cards",
    description: "Only basic Q&A format cards",
    filters: { cardTypes: ["basic"] },
  },
];

export default function ExportPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState("all");
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "apkg">("json");
  const [exporting, setExporting] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    includeExplanations: true,
    includeMnemonics: true,
    includeClinicalPearls: true,
    includeReferences: false,
  });

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch("/api/cards");
      const data = await res.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error("Failed to fetch cards:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleExport = async () => {
    if (cards.length === 0) {
      toast({ title: "No cards to export", variant: "destructive" });
      return;
    }

    setExporting(true);
    
    try {
      let url = `/api/export?format=${exportFormat}`;
      
      // Apply preset filters
      const preset = EXPORT_PRESETS.find(p => p.id === selectedPreset);
      if (preset?.filters.difficulty) {
        url += `&difficulty=${preset.filters.difficulty.join(",")}`;
      }
      if (preset?.filters.cardTypes) {
        url += `&cardType=${preset.filters.cardTypes.join(",")}`;
      }

      const res = await fetch(url);
      const blob = await res.blob();
      
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `anki_icu_${selectedPreset}_${new Date().toISOString().split("T")[0]}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({ 
        title: "Export complete!", 
        description: `${cards.length} cards exported as ${exportFormat.toUpperCase()}` 
      });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Get unique chapters for stats
  const chapters = [...new Set(cards.map(c => c.chapter))];
  const difficulties = {
    easy: cards.filter(c => c.difficulty === "easy").length,
    medium: cards.filter(c => c.difficulty === "medium").length,
    hard: cards.filter(c => c.difficulty === "hard").length,
  };
  const types = {
    cloze: cards.filter(c => c.ankiType === "cloze").length,
    basic: cards.filter(c => c.ankiType === "basic").length,
    both: cards.filter(c => c.ankiType === "cloze_and_basic").length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Export</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export to Anki</h1>
        <p className="text-muted-foreground mt-2">
          Download your cards in a format compatible with Anki.
        </p>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Download className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Cards to Export</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Generate some cards first before exporting.
                </p>
              </div>
              <Button asChild>
                <Link href="/generate">Start Generating</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Cards"
              value={cards.length}
              icon={Layers}
            />
            <StatCard
              title="Chapters"
              value={chapters.length}
              icon={BookOpen}
            />
            <StatCard
              title="Easy"
              value={difficulties.easy}
              icon={GraduationCap}
              color="text-green-600"
            />
            <StatCard
              title="Hard"
              value={difficulties.hard}
              icon={GraduationCap}
              color="text-red-600"
            />
          </div>

          {/* Export Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Export Configuration
              </CardTitle>
              <CardDescription>
                Choose what cards to include and how to format them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format Selection */}
              <div className="space-y-3">
                <Label>Export Format</Label>
                <div className="grid grid-cols-3 gap-3">
                  <FormatOption
                    id="json"
                    label="JSON"
                    description="Raw data format"
                    icon={FileJson}
                    selected={exportFormat === "json"}
                    onClick={() => setExportFormat("json")}
                  />
                  <FormatOption
                    id="csv"
                    label="CSV"
                    description="Spreadsheet format"
                    icon={FileSpreadsheet}
                    selected={exportFormat === "csv"}
                    onClick={() => setExportFormat("csv")}
                  />
                  <FormatOption
                    id="apkg"
                    label="Anki Deck"
                    description="Direct Anki import"
                    icon={Package}
                    selected={exportFormat === "apkg"}
                    onClick={() => setExportFormat("apkg")}
                    disabled
                  />
                </div>
                {exportFormat === "apkg" && (
                  <p className="text-xs text-muted-foreground">
                    Anki package export coming soon. Use JSON import with Anki for now.
                  </p>
                )}
              </div>

              {/* Preset Selection */}
              <div className="space-y-3">
                <Label>Export Preset</Label>
                <div className="grid gap-3">
                  {EXPORT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPreset(preset.id)}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border text-left transition-all",
                        selectedPreset === preset.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0",
                        selectedPreset === preset.id ? "border-primary" : "border-muted-foreground"
                      )}>
                        {selectedPreset === preset.id && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="font-medium">{preset.name}</p>
                        <p className="text-sm text-muted-foreground">{preset.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Options */}
              <div className="space-y-3">
                <Label>Include Extra Fields</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="explanations"
                      checked={customFilters.includeExplanations}
                      onCheckedChange={(checked) => 
                        setCustomFilters(prev => ({ ...prev, includeExplanations: checked as boolean }))
                      }
                    />
                    <Label htmlFor="explanations" className="text-sm cursor-pointer">
                      Explanations
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mnemonics"
                      checked={customFilters.includeMnemonics}
                      onCheckedChange={(checked) => 
                        setCustomFilters(prev => ({ ...prev, includeMnemonics: checked as boolean }))
                      }
                    />
                    <Label htmlFor="mnemonics" className="text-sm cursor-pointer">
                      Mnemonics
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pearls"
                      checked={customFilters.includeClinicalPearls}
                      onCheckedChange={(checked) => 
                        setCustomFilters(prev => ({ ...prev, includeClinicalPearls: checked as boolean }))
                      }
                    />
                    <Label htmlFor="pearls" className="text-sm cursor-pointer">
                      Clinical Pearls
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="references"
                      checked={customFilters.includeReferences}
                      onCheckedChange={(checked) => 
                        setCustomFilters(prev => ({ ...prev, includeReferences: checked as boolean }))
                      }
                    />
                    <Label htmlFor="references" className="text-sm cursor-pointer">
                      References
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Export Preview</CardTitle>
              <CardDescription>Summary of what will be exported</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Format</span>
                <Badge variant="outline">{exportFormat.toUpperCase()}</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Preset</span>
                <span className="font-medium">
                  {EXPORT_PRESETS.find(p => p.id === selectedPreset)?.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Cards to Export</span>
                <span className="font-medium">{cards.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Chapters</span>
                <span className="font-medium">{chapters.length}</span>
              </div>
              
              {/* Difficulty Breakdown */}
              <div className="space-y-2 pt-2">
                <span className="text-sm text-muted-foreground">Difficulty Distribution</span>
                <div className="flex gap-2">
                  {difficulties.easy > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {difficulties.easy} Easy
                    </Badge>
                  )}
                  {difficulties.medium > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                      {difficulties.medium} Medium
                    </Badge>
                  )}
                  {difficulties.hard > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      {difficulties.hard} Hard
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Button */}
          <div className="flex justify-end">
            <Button 
              size="lg" 
              onClick={handleExport}
              disabled={exporting || cards.length === 0 || exportFormat === "apkg"}
              className="min-w-[200px]"
            >
              {exporting ? (
                <><Clock className="h-5 w-5 mr-2 animate-spin" /> Exporting...</>
              ) : (
                <><Download className="h-5 w-5 mr-2" /> Export {cards.length} Cards</>
              )}
            </Button>
          </div>

          {/* Instructions */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-sm">How to Import into Anki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p><strong>JSON Format:</strong> Use the CrowdAnki addon or import as text.</p>
              <p><strong>CSV Format:</strong> File → Import → Select CSV → Match fields.</p>
              <p><strong>Anki Deck (.apkg):</strong> Coming soon! Double-click to import.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className={cn("h-5 w-5 text-primary", color)} />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FormatOption({
  id,
  label,
  description,
  icon: Icon,
  selected,
  onClick,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed hover:border-border"
      )}
    >
      <Icon className={cn("h-8 w-8", selected ? "text-primary" : "text-muted-foreground")} />
      <div className="text-center">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
