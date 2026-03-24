"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  GraduationCap, 
  Brain, 
  Lightbulb, 
  Sparkles, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  BookOpen,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { cardsApiUrl } from "@/lib/api-config";

interface AnkiCard {
  id: string;
  cardId: string;
  chapter: string;
  difficulty: string;
  ankiType: string;
  clozeText: string | null;
  front: string | null;
  back: string | null;
  explanation: string | null;
  mnemonic: string | null;
  clinicalPearl: string | null;
  pitfalls: string | null;
}

export default function StudyPage() {
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExtras, setShowExtras] = useState({
    explanation: true,
    mnemonic: true,
    clinicalPearl: true,
    pitfalls: false,
  });

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch(cardsApiUrl);
      const data = await res.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error("Failed to fetch cards:", error);
      toast({ title: "Failed to load cards", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  const nextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setFlipped(false);
    }
  };

  const renderCloze = (text: string, revealed: boolean) => {
    if (!text) return "";
    return text.replace(/\{\{c(\d+)::(.*?)\}\}/g, (_, num, val) => {
      if (revealed) {
        return num === "1"
          ? `<span class="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded font-medium">${val}</span>`
          : `<span class="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">${val}</span>`;
      }
      return `<span class="bg-primary/20 px-3 py-0.5 rounded font-medium tracking-widest">___</span>`;
    }).replace(/\n/g, "<br>");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Study Mode</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Mode</h1>
          <p className="text-muted-foreground mt-2">
            Preview and study your generated cards before exporting to Anki.
          </p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <GraduationCap className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Cards Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Generate some cards first to start studying.
                </p>
              </div>
              <Button asChild>
                <Link href="/generate">Start Generating</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study Mode</h1>
          <p className="text-muted-foreground mt-1">
            Card {currentIndex + 1} of {cards.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{currentCard?.ankiType}</Badge>
          <Badge 
            variant={currentCard?.difficulty === "easy" ? "secondary" : currentCard?.difficulty === "hard" ? "destructive" : "default"}
            className="capitalize"
          >
            {currentCard?.difficulty}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-2" />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevCard}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </span>
        <Button
          variant="outline"
          onClick={nextCard}
          disabled={currentIndex === cards.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Card Display */}
      {currentCard && (
        <div className="space-y-6">
          {/* Main Card */}
          <Card className="min-h-[300px] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {currentCard.chapter}
                </CardDescription>
                <Button variant="ghost" size="sm" onClick={() => setFlipped(!flipped)}>
                  {flipped ? <><EyeOff className="h-4 w-4 mr-2" /> Hide Answer</> : <><Eye className="h-4 w-4 mr-2" /> Show Answer</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              {currentCard.clozeText ? (
                <div 
                  className="text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: renderCloze(currentCard.clozeText, flipped) 
                  }} 
                />
              ) : currentCard.front ? (
                <div className="space-y-4">
                  <div 
                    className="text-base leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: renderCloze(currentCard.front, false) 
                    }} 
                  />
                  {flipped && currentCard.back && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2">ANSWER</p>
                      <div 
                        className="text-base leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: currentCard.back }} 
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No content available</p>
              )}
            </CardContent>
          </Card>

          {/* Extras Toggle */}
          <div className="flex flex-wrap gap-2">
            <ExtraToggle
              label="Explanation"
              active={showExtras.explanation}
              onClick={() => setShowExtras(prev => ({ ...prev, explanation: !prev.explanation }))}
              icon={Lightbulb}
              available={!!currentCard.explanation}
            />
            <ExtraToggle
              label="Mnemonic"
              active={showExtras.mnemonic}
              onClick={() => setShowExtras(prev => ({ ...prev, mnemonic: !prev.mnemonic }))}
              icon={Brain}
              available={!!currentCard.mnemonic}
            />
            <ExtraToggle
              label="Clinical Pearl"
              active={showExtras.clinicalPearl}
              onClick={() => setShowExtras(prev => ({ ...prev, clinicalPearl: !prev.clinicalPearl }))}
              icon={Sparkles}
              available={!!currentCard.clinicalPearl}
            />
            <ExtraToggle
              label="Pitfalls"
              active={showExtras.pitfalls}
              onClick={() => setShowExtras(prev => ({ ...prev, pitfalls: !prev.pitfalls }))}
              icon={AlertTriangle}
              available={!!currentCard.pitfalls}
            />
          </div>

          {/* Extras Content */}
          <div className="space-y-3">
            {showExtras.explanation && currentCard.explanation && (
              <ExtraCard
                title="Explanation"
                content={currentCard.explanation}
                icon={Lightbulb}
                color="blue"
              />
            )}
            {showExtras.mnemonic && currentCard.mnemonic && (
              <ExtraCard
                title="Mnemonic"
                content={currentCard.mnemonic}
                icon={Brain}
                color="purple"
              />
            )}
            {showExtras.clinicalPearl && currentCard.clinicalPearl && (
              <ExtraCard
                title="Clinical Pearl"
                content={currentCard.clinicalPearl}
                icon={Sparkles}
                color="amber"
              />
            )}
            {showExtras.pitfalls && currentCard.pitfalls && (
              <ExtraCard
                title="Pitfalls"
                content={currentCard.pitfalls}
                icon={AlertTriangle}
                color="red"
              />
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">Space</kbd>
              <span className="text-muted-foreground">Flip card</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">←</kbd>
              <span className="text-muted-foreground">Previous</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">→</kbd>
              <span className="text-muted-foreground">Next</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-background border rounded text-xs">R</kbd>
              <span className="text-muted-foreground">Reset</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExtraToggle({
  label,
  active,
  onClick,
  icon: Icon,
  available,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  available: boolean;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={!available}
      className={cn(!available && "opacity-50")}
    >
      <Icon className="h-3 w-3 mr-1" />
      {label}
      {!available && <span className="ml-1 text-xs opacity-50">(N/A)</span>}
    </Button>
  );
}

function ExtraCard({
  title,
  content,
  icon: Icon,
  color,
}: {
  title: string;
  content: string;
  icon: React.ElementType;
  color: "blue" | "purple" | "amber" | "red";
}) {
  const colorClasses = {
    blue: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
    purple: "border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20",
    amber: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20",
    red: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20",
  };

  const iconColors = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };

  return (
    <Card className={cn("border", colorClasses[color])}>
      <CardHeader className="pb-2">
        <CardTitle className={cn("text-sm flex items-center gap-2", iconColors[color])}>
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  );
}
