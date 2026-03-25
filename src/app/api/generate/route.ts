import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  MAX_BATCH_SIZE,
  MAX_QUESTION_COUNT,
  MIN_BATCH_SIZE,
  MIN_QUESTION_COUNT,
  clampInt,
} from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import { resolveIncludedChapterIds, type DetectedChapter } from "@/lib/chapters";
import type { AnkiCard } from "@prisma/client";

// POST - Generate cards (single batch or continue sequence)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mode = "single",
      chapterIds,
      cardType: overrideCardType,
      extras: overrideExtras,
      questionCount: rawQuestionCount = 5,
      updateProgress = true,
    } = body;

    let progress = await db.generationProgress.findUnique({ where: { id: "main" } });
    const sourceFile = await db.sourceFile.findFirst({ orderBy: { createdAt: "desc" } });

    const cardType = overrideCardType || progress?.cardType || "cloze";
    const extras =
      overrideExtras ?? safeJsonArray(progress?.extras, ["explanation"]);
    const batchSize = clampInt(
      progress?.batchSize ?? 5,
      MIN_BATCH_SIZE,
      MAX_BATCH_SIZE,
      5,
    );

    const targetQuestionCount = clampInt(
      rawQuestionCount,
      MIN_QUESTION_COUNT,
      MAX_QUESTION_COUNT,
      5,
    );

    let content = "";
    let chapters: DetectedChapter[] = [];

    if (sourceFile?.content) {
      content = sourceFile.content;
      chapters = safeJsonArray(sourceFile.chapters, []);
    } else {
      return NextResponse.json(
        { error: "No source file found. Please upload a file first." },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json({ error: "No content available" }, { status: 400 });
    }

    let targetChapters: number[] = [];
    let effectiveQuestionCount = targetQuestionCount;
    let isSequential = false;

    if (mode === "continue" && progress) {
      targetChapters = [progress.currentChapterId];
      effectiveQuestionCount = batchSize;
      isSequential = true;
    } else if (mode === "batch" && progress) {
      targetChapters = [progress.currentChapterId];
      effectiveQuestionCount = batchSize;
      isSequential = true;
    } else if (chapterIds && chapterIds.length > 0) {
      targetChapters = chapterIds;
      effectiveQuestionCount = targetQuestionCount;
    } else if (mode === "single") {
      const fallbackId = chapters[0]?.id ?? 1;
      targetChapters = [progress?.currentChapterId ?? fallbackId];
      effectiveQuestionCount = targetQuestionCount;
      isSequential = false;
    } else {
      return NextResponse.json({ error: "No chapters specified" }, { status: 400 });
    }

    const chapterContents: string[] = [];
    for (const chId of targetChapters) {
      const ch = chapters.find((c) => c.id === chId);
      if (ch) {
        const lines = content.split("\n");
        const chContent = lines.slice(ch.startIdx, Math.min(ch.endIdx, ch.startIdx + 500)).join("\n");
        chapterContents.push(`\n=== CHAPTER ${ch.id}: ${ch.label} ===\n${chContent}`);
      }
    }

    if (chapterContents.length === 0) {
      return NextResponse.json({ error: "No chapter content found" }, { status: 400 });
    }

    const maxContentLength = 35000;
    let combinedContent = chapterContents.join("\n\n");
    if (combinedContent.length > maxContentLength) {
      combinedContent = combinedContent.slice(0, maxContentLength) + "\n... [content truncated]";
    }

    const userPrompt = `Generate ${effectiveQuestionCount} Anki flashcards from the following Neurocritical Care Board Review content.

Focus on extracting questions and their answers. For each question:
1. Extract the full clinical vignette
2. Include ALL answer choices exactly as written
3. Identify the correct answer
4. Create the card in the specified format

Content:
${combinedContent}

Generate ${effectiveQuestionCount} cards now. Return ONLY valid JSON.`;

    if (updateProgress && isSequential) {
      await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "running",
          lastRunAt: new Date(),
          cardType,
          extras: JSON.stringify(extras),
        },
      });
    }

    const authHeader = request.headers.get("Authorization");
    let apiKey = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || null;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Unauthorized: Missing AI API Key. Please provide it in the settings." },
        { status: 401 }
      );
    }

    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(cardType, extras) },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API request failed with status ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const responseContent: string | null = data.choices?.[0]?.message?.content ?? null;

    if (!responseContent) {
      throw new Error("No response from AI");
    }

    let cards: unknown;
    try {
      let jsonStr = responseContent;
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      const arrayStart = jsonStr.indexOf("[");
      const arrayEnd = jsonStr.lastIndexOf("]");
      if (arrayStart !== -1 && arrayEnd !== -1) {
        jsonStr = jsonStr.slice(arrayStart, arrayEnd + 1);
      }
      cards = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response");
      if (isSequential) {
        await db.generationProgress.update({
          where: { id: "main" },
          data: {
            status: "paused",
            lastError: "Failed to parse AI response",
          },
        });
      }
      const debug = process.env.DEBUG_AI === "1";
      const payload: { error: string; rawResponse?: string } = {
        error: "Failed to parse AI response",
      };
      if (debug) payload.rawResponse = responseContent.slice(0, 1000);
      return NextResponse.json(payload, { status: 500 });
    }

    if (!Array.isArray(cards)) {
      throw new Error("AI did not return an array");
    }

    const validCards = cards.filter((card) => typeof card === "object" && card && !(card as { _meta?: unknown })._meta);
    const savedCards: AnkiCard[] = [];

    for (const card of validCards) {
      try {
        const c = card as Record<string, unknown>;
        const chapterId = targetChapters[0] || 1;
        const stableCardId =
          typeof c.id === "string" && c.id.length > 0
            ? c.id
            : `ch${chapterId}_q${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        const savedCard = await db.ankiCard.upsert({
          where: { cardId: stableCardId },
          create: {
            cardId: stableCardId,
            chapter:
              (c.chapter as string) ||
              chapters.find((ch) => ch.id === chapterId)?.label ||
              `Chapter ${chapterId}`,
            chapterId,
            sourceQNumber: (c.source_q_number as number) || 0,
            difficulty: (c.difficulty as string) || "medium",
            tags: JSON.stringify(c.tags || []),
            ankiType: (c.anki_type as string) || cardType,
            clozeText: c.cloze_text as string | undefined,
            front: c.front as string | undefined,
            back: c.back as string | undefined,
            explanation: c.explanation as string | undefined,
            mnemonic: c.mnemonic as string | undefined,
            clinicalPearl: c.clinical_pearl as string | undefined,
            references: JSON.stringify(c.references || []),
            pitfalls: c.pitfalls as string | undefined,
            imageDependent: Boolean(c.image_dependent),
            seeAlso: JSON.stringify(c.see_also || []),
            rawJson: JSON.stringify(card),
          },
          update: {
            chapter: c.chapter as string | undefined,
            chapterId,
            sourceQNumber: c.source_q_number as number | undefined,
            difficulty: c.difficulty as string | undefined,
            tags: JSON.stringify(c.tags || []),
            ankiType: (c.anki_type as string) || cardType,
            clozeText: c.cloze_text as string | undefined,
            front: c.front as string | undefined,
            back: c.back as string | undefined,
            explanation: c.explanation as string | undefined,
            mnemonic: c.mnemonic as string | undefined,
            clinicalPearl: c.clinical_pearl as string | undefined,
            references: JSON.stringify(c.references || []),
            pitfalls: c.pitfalls as string | undefined,
            imageDependent: Boolean(c.image_dependent),
            seeAlso: JSON.stringify(c.see_also || []),
            rawJson: JSON.stringify(card),
          },
        });
        savedCards.push(savedCard);
      } catch (dbError) {
        console.error("Failed to save card:", dbError);
      }
    }

    if (updateProgress && isSequential) {
      const includedIds = resolveIncludedChapterIds(chapters, progress?.includedChapterIds ?? null);
      const orderedChapters = chapters.filter((ch) => includedIds.includes(ch.id));

      const currentChapter = orderedChapters.find((ch) => ch.id === targetChapters[0]);
      const newQuestionNumber = (progress?.currentQuestionNumber || 0) + savedCards.length;
      const chapterComplete =
        currentChapter && newQuestionNumber >= (currentChapter.questionCount || 100);

      let nextChapterId = targetChapters[0];
      let nextQuestionNumber = newQuestionNumber;

      if (chapterComplete) {
        const currentIdx = orderedChapters.findIndex((ch) => ch.id === targetChapters[0]);
        if (currentIdx >= 0 && currentIdx < orderedChapters.length - 1) {
          nextChapterId = orderedChapters[currentIdx + 1].id;
          nextQuestionNumber = 0;
        }
      }

      const allComplete = chapterComplete && nextChapterId === targetChapters[0];

      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: {
          currentChapterId: nextChapterId,
          currentQuestionNumber: nextQuestionNumber,
          totalCardsGenerated: (progress?.totalCardsGenerated || 0) + savedCards.length,
          status: allComplete ? "completed" : "idle",
          lastError: null,
          completedAt: allComplete ? new Date() : null,
        },
      });
    }

    const responseExtras = progress
      ? safeJsonArray(progress.extras, [])
      : [];

    return NextResponse.json({
      success: true,
      generatedCount: cards.length,
      savedCount: savedCards.length,
      cards: savedCards,
      progress: progress
        ? {
            ...progress,
            extras: responseExtras,
          }
        : null,
    });
  } catch (error) {
    console.error("Generation error:", error);

    try {
      await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "paused",
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
    } catch {
      /* ignore */
    }

    return serverErrorResponse("Failed to generate cards", error);
  }
}

function buildSystemPrompt(cardType: string, extras: string[]): string {
  const extraFieldsSchema = extras
    .map((id) => {
      const map: Record<string, string> = {
        explanation: `    "explanation": "3–5 sentence mechanism + distractor analysis",`,
        mnemonic: `    "mnemonic": "memorable mnemonic device",`,
        clinical: `    "clinical_pearl": "one bedside insight",`,
        resources: `    "references": ["Author et al. Journal. Year. doi:..."],`,
        ddx: `    "pitfalls": "• Wrong A: reason\\n• Wrong B: reason\\n• Lookalike: scenario → answer",`,
      };
      return map[id] || "";
    })
    .filter(Boolean)
    .join("\n");

  const clozeSchema =
    cardType !== "basic"
      ? `
    "cloze_text": "Full vignette + ALL answer choices visible. Answer line at bottom: The correct answer is {{c1::LETTER}} — {{c2::answer text}}.",`
      : "";

  const basicSchema =
    cardType !== "cloze"
      ? `
    "front": "Complete clinical vignette + all answer choices A–D exactly as in the textbook",
    "back": "<b>Answer X — [answer text]</b><br><br>Brief rationale (2–3 sentences). Why wrong answers fail.",`
      : "";

  return `You are an expert Neurocritical Care educator creating high-yield Anki flashcards.

## OUTPUT FORMAT
Return ONLY a valid JSON array. No markdown, no preamble, no explanation.

[
  {
    "id": "ch{chapter_number}_q{question_number}",
    "chapter": "Full chapter name",
    "source_q_number": <integer>,
    "difficulty": "easy | medium | hard",
    "tags": ["topic-tag", "trial-name", "drug-name", "difficulty-tier"],
    "anki_type": "${cardType === "both" ? "cloze_and_basic" : cardType}",${clozeSchema}${basicSchema}
${extraFieldsSchema}
    "image_dependent": false,
    "see_also": []
  }
]

## CLOZE FORMAT — ALL ANSWER CHOICES VISIBLE, ANSWER HIDDEN AT BOTTOM
The cloze_text field must contain:
1. Full clinical vignette (copy verbatim)
2. The question stem
3. All answer choices listed exactly as written (NO cloze deletions in choices):
   A. [full text]
   B. [full text]
   C. [full text]
   D. [full text]
4. A blank line, then: The correct answer is {{c1::LETTER}} — {{c2::answer name}}.

CLOZE DELETION RULES:
- {{c1::LETTER}} — the answer letter (A, B, C, D). PRIMARY test.
- {{c2::text}} — the key name from the correct answer.
- Do NOT put cloze deletions inside the vignette or answer choices.
- All answer choices must remain VISIBLE.

## DIFFICULTY RUBRIC
- **easy**: Direct recall — drug name, classification, single number
- **medium**: Clinical reasoning — integrating 2–3 facts, distinguishing similar options
- **hard**: Nuanced management — competing priorities, contraindications with exceptions

## TAGGING
Apply 3–7 tags per card in kebab-case:
1. Chapter topic
2. Mechanism/concept
3. Drug or trial (when applicable)
4. Difficulty tier: "high-yield" or "board-tested" or "nuanced"
5. Question type: "threshold", "mechanism", "management", "diagnosis", "prognosis"`;
}
