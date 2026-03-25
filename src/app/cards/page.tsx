"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cardsApiUrl } from "@/lib/api-config";
import { 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  Eye,
  MoreHorizontal,
  Layers,
  BookOpen,
  GraduationCap,
  X,
  Check,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Brain,
  Lightbulb,
  Sparkles,
  AlertTriangle,
  BookMarked,
  ListOrdered,
} from "lucide-react";
import Link from "next/link";

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
  ddx: string | null;
  imageDependent: boolean;
  createdAt: string;
}

interface CardFilters {
  search: string;
  chapter: string;
  difficulty: string;
  type: string;
}

const ITEMS_PER_PAGE = 20;

export default function CardsPage() {
  const [cards, setCards] = useState<AnkiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [viewingCard, setViewingCard] = useState<AnkiCard | null>(null);
  const [filters, setFilters] = useState<CardFilters>({
    search: "",
    chapter: "all",
    difficulty: "all",
    type: "all",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof AnkiCard>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Fetch cards
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

  // Get unique values for filters
  const chapters = useMemo(() => {
    const unique = new Set(cards.map(c => c.chapter));
    return Array.from(unique).sort();
  }, [cards]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let result = [...cards];

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(card => 
        card.cardId.toLowerCase().includes(searchLower) ||
        card.chapter.toLowerCase().includes(searchLower) ||
        card.clozeText?.toLowerCase().includes(searchLower) ||
        card.front?.toLowerCase().includes(searchLower) ||
        card.tags.toLowerCase().includes(searchLower)
      );
    }

    if (filters.chapter !== "all") {
      result = result.filter(card => card.chapter === filters.chapter);
    }

    if (filters.difficulty !== "all") {
      result = result.filter(card => card.difficulty === filters.difficulty);
    }

    if (filters.type !== "all") {
      result = result.filter(card => card.ankiType === filters.type);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      
      if (aVal == null || bVal == null) return 0;
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [cards, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = filteredCards.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handlers
  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedCards.size === paginatedCards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(paginatedCards.map(c => c.id)));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selectedCards.size} selected cards?`)) return;
    
    try {
      // Delete one by one (API doesn't support bulk delete yet)
      for (const cardId of selectedCards) {
        await fetch(`/api/cards?id=${cardId}`, { method: "DELETE" });
      }
      toast({ title: `Deleted ${selectedCards.size} cards` });
      setSelectedCards(new Set());
      fetchCards();
    } catch {
      toast({ title: "Failed to delete cards", variant: "destructive" });
    }
  };

  const deleteAll = async () => {
    if (!confirm("Delete ALL cards? This cannot be undone.")) return;
    
    try {
      await fetch("/api/cards", { method: "DELETE" });
      toast({ title: "All cards deleted" });
      setCards([]);
      setSelectedCards(new Set());
    } catch {
      toast({ title: "Failed to delete cards", variant: "destructive" });
    }
  };

  const exportSelected = async (format: "json" | "csv") => {
    const selectedCardData = cards.filter(c => selectedCards.has(c.id));
    
    if (format === "json") {
      const blob = new Blob([JSON.stringify(selectedCardData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selected_cards.json`;
      a.click();
    } else {
      // Simple CSV export
      const headers = ["id", "chapter", "difficulty", "type", "content"];
      const rows = selectedCardData.map(c => [
        c.cardId,
        c.chapter,
        c.difficulty,
        c.ankiType,
        (c.clozeText || c.front || "").slice(0, 100).replace(/,/g, ";")
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selected_cards.csv`;
      a.click();
    }
    
    toast({ title: `Exported ${selectedCards.size} cards as ${format.toUpperCase()}` });
  };

  const handleSort = (field: keyof AnkiCard) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      chapter: "all",
      difficulty: "all",
      type: "all",
    });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.search || filters.chapter !== "all" || filters.difficulty !== "all" || filters.type !== "all";

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Card Library</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Card Library</h1>
          <p className="text-muted-foreground mt-1">
            {cards.length} total cards • {filteredCards.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <Button variant="outline" asChild>
              <Link href="/export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/generate">
              <Layers className="h-4 w-4 mr-2" />
              Generate More
            </Link>
          </Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-muted rounded-full">
                <Layers className="h-10 w-10 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Cards Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Generate cards from your textbook to start building your Anki deck.
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
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cards..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={filters.chapter}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, chapter: v }))}
                  >
                    <SelectTrigger className="w-[180px]">
                      <BookOpen className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Chapters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Chapters</SelectItem>
                      {chapters.map(ch => (
                        <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.difficulty}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, difficulty: v }))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <GraduationCap className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.type}
                    onValueChange={(v) => setFilters(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Layers className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Card Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="cloze">Cloze</SelectItem>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="cloze_and_basic">Both</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="icon" onClick={clearFilters}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedCards.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedCards.size} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => exportSelected("json")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button variant="ghost" size="sm" onClick={() => exportSelected("csv")}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Cards Table */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b">
                <div className="grid grid-cols-[40px_1fr_120px_100px_100px_50px] gap-4 p-4 text-sm font-medium text-muted-foreground">
                  <Checkbox 
                    checked={paginatedCards.length > 0 && selectedCards.size === paginatedCards.length}
                    onCheckedChange={toggleAllSelection}
                  />
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("chapter")}
                  >
                    Card
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("chapter")}
                  >
                    Chapter
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("difficulty")}
                  >
                    Difficulty
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort("ankiType")}
                  >
                    Type
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <span></span>
                </div>
              </div>
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {paginatedCards.map((card) => (
                    <div 
                      key={card.id}
                      className={cn(
                        "grid grid-cols-[40px_1fr_120px_100px_100px_50px] gap-4 p-4 items-center text-sm hover:bg-accent/50 transition-colors",
                        selectedCards.has(card.id) && "bg-primary/5"
                      )}
                    >
                      <Checkbox 
                        checked={selectedCards.has(card.id)}
                        onCheckedChange={() => toggleCardSelection(card.id)}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{card.cardId}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(card.clozeText || card.front || "").slice(0, 60)}...
                        </p>
                      </div>
                      <span className="truncate text-xs" title={card.chapter}>{card.chapter}</span>
                      <Badge 
                        variant={card.difficulty === "easy" ? "secondary" : card.difficulty === "hard" ? "destructive" : "default"}
                        className="w-fit text-xs capitalize"
                      >
                        {card.difficulty}
                      </Badge>
                      <Badge variant="outline" className="w-fit text-xs">
                        {card.ankiType}
                      </Badge>
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingCard(card)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={async () => {
                                if (confirm("Delete this card?")) {
                                  await fetch(`/api/cards?id=${card.id}`, { method: "DELETE" });
                                  fetchCards();
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCards.length)} of {filteredCards.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Delete All */}
          <div className="flex justify-end">
            <Button variant="ghost" className="text-destructive" onClick={deleteAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All Cards
            </Button>
          </div>
        </>
      )}

      {/* Card Detail Dialog */}
      <Dialog open={!!viewingCard} onOpenChange={() => setViewingCard(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              {viewingCard?.cardId}
            </DialogTitle>
            <DialogDescription>
              {viewingCard?.chapter}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={viewingCard?.difficulty === "easy" ? "secondary" : viewingCard?.difficulty === "hard" ? "destructive" : "default"}>
                  {viewingCard?.difficulty}
                </Badge>
                <Badge variant="outline">{viewingCard?.ankiType}</Badge>
                {viewingCard?.imageDependent && (
                  <Badge variant="outline" className="text-yellow-600">Image Dependent</Badge>
                )}
              </div>

              {/* Content */}
              {viewingCard?.clozeText && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cloze Format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-secondary/50 p-4 rounded-lg">
                      {viewingCard.clozeText}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.front && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Basic Format - Front</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-secondary/50 p-4 rounded-lg">
                      {viewingCard.front}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.back && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Basic Format - Back</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap font-mono bg-secondary/50 p-4 rounded-lg">
                      {viewingCard.back}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Extras */}
              {viewingCard?.explanation && (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
                      <Lightbulb className="h-4 w-4" />
                      Explanation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{viewingCard.explanation}</p>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.mnemonic && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-purple-600">
                      <Brain className="h-4 w-4" />
                      Mnemonic
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm italic">{viewingCard.mnemonic}</p>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.clinicalPearl && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                      <Sparkles className="h-4 w-4" />
                      Clinical Pearl
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{viewingCard.clinicalPearl}</p>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.ddx && (
                <Card className="border-teal-200 dark:border-teal-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-teal-600">
                      <ListOrdered className="h-4 w-4" />
                      Differential diagnosis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{viewingCard.ddx}</p>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.pitfalls && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      Pitfalls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{viewingCard.pitfalls}</p>
                  </CardContent>
                </Card>
              )}

              {viewingCard?.references && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookMarked className="h-4 w-4" />
                      References
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm whitespace-pre-wrap">{viewingCard.references}</pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setViewingCard(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
