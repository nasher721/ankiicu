import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ZAI from "z-ai-web-dev-sdk";

const prisma = new PrismaClient();

// POST - Generate cards (single batch or continue sequence)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      mode = "single", // single, continue, batch
      chapterIds, 
      cardType: overrideCardType, 
      extras: overrideExtras, 
      questionCount = 5,
      updateProgress = true,
    } = body;

    // Get current progress state
    let progress = await prisma.generationProgress.findUnique({ where: { id: "main" } });
    const sourceFile = await prisma.sourceFile.findFirst({ orderBy: { createdAt: "desc" } });

    // Determine settings from progress or overrides
    const cardType = overrideCardType || progress?.cardType || "cloze";
    const extras = overrideExtras || (progress?.extras ? JSON.parse(progress.extras) : ["explanation"]);
    const batchSize = progress?.batchSize || 5;

    // Get content source
    let content = "";
    let chapters: Array<{ id: number; label: string; startIdx: number; endIdx: number; questionCount: number }> = [];
    
    if (sourceFile?.content) {
      content = sourceFile.content;
      chapters = JSON.parse(sourceFile.chapters || "[]");
    } else {
      // Fallback to uploaded PDF file
      const fs = await import("fs");
      const path = await import("path");
      const pdfPath = "/home/z/my-project/upload/Neurocritical Care Board Review_ Questions and Answers-Demos Medical (2018).pdf.md";
      try {
        content = fs.readFileSync(pdfPath, "utf-8");
        chapters = extractChaptersFromContent(content);
      } catch {
        return NextResponse.json({ error: "No source file found. Please upload a file first." }, { status: 400 });
      }
    }

    if (!content) {
      return NextResponse.json({ error: "No content available" }, { status: 400 });
    }

    // Determine which chapters/questions to process
    let targetChapters: number[] = [];
    let targetQuestionCount = questionCount;
    let isSequential = false;

    if (mode === "continue" && progress) {
      // Continue from where we left off
      targetChapters = [progress.currentChapterId];
      targetQuestionCount = batchSize;
      isSequential = true;
    } else if (mode === "batch" && progress) {
      // Process next batch in sequence
      targetChapters = [progress.currentChapterId];
      targetQuestionCount = batchSize;
      isSequential = true;
    } else if (chapterIds && chapterIds.length > 0) {
      // Process specified chapters
      targetChapters = chapterIds;
    } else {
      return NextResponse.json({ error: "No chapters specified" }, { status: 400 });
    }

    // Extract content for target chapters
    const chapterContents: string[] = [];
    for (const chId of targetChapters) {
      const ch = chapters.find(c => c.id === chId);
      if (ch) {
        const lines = content.split("\n");
        const chContent = lines.slice(ch.startIdx, Math.min(ch.endIdx, ch.startIdx + 500)).join("\n");
        chapterContents.push(`\n=== CHAPTER ${ch.id}: ${ch.label} ===\n${chContent}`);
      }
    }

    if (chapterContents.length === 0) {
      return NextResponse.json({ error: "No chapter content found" }, { status: 400 });
    }

    // Limit content size
    const maxContentLength = 35000;
    let combinedContent = chapterContents.join("\n\n");
    if (combinedContent.length > maxContentLength) {
      combinedContent = combinedContent.slice(0, maxContentLength) + "\n... [content truncated]";
    }

    // Build prompt and call AI
    const userPrompt = `Generate ${targetQuestionCount} Anki flashcards from the following Neurocritical Care Board Review content.

Focus on extracting questions and their answers. For each question:
1. Extract the full clinical vignette
2. Include ALL answer choices exactly as written
3. Identify the correct answer
4. Create the card in the specified format

Content:
${combinedContent}

Generate ${targetQuestionCount} cards now. Return ONLY valid JSON.`;

    // Update progress to running
    if (updateProgress && isSequential) {
      await prisma.generationProgress.update({
        where: { id: "main" },
        data: { 
          status: "running",
          lastRunAt: new Date(),
          cardType,
          extras: JSON.stringify(extras),
        },
      });
    }

    // Call AI
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      model: "glm-5",
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(cardType, extras),
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 8000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    // Parse response
    let cards;
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
        await prisma.generationProgress.update({
          where: { id: "main" },
          data: { 
            status: "paused",
            lastError: "Failed to parse AI response",
          },
        });
      }
      return NextResponse.json({ 
        error: "Failed to parse AI response",
        rawResponse: responseContent.slice(0, 1000),
      }, { status: 500 });
    }

    if (!Array.isArray(cards)) {
      throw new Error("AI did not return an array");
    }

    // Save cards
    const validCards = cards.filter(card => !card._meta);
    const savedCards = [];
    
    for (const card of validCards) {
      try {
        const chapterId = targetChapters[0] || 1;
        const savedCard = await prisma.ankiCard.upsert({
          where: { cardId: card.id || `ch${chapterId}_q${Date.now()}_${Math.random().toString(36).slice(2, 7)}` },
          create: {
            cardId: card.id || `ch${chapterId}_q${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            chapter: card.chapter || chapters.find(c => c.id === chapterId)?.label || `Chapter ${chapterId}`,
            chapterId,
            sourceQNumber: card.source_q_number || 0,
            difficulty: card.difficulty || "medium",
            tags: JSON.stringify(card.tags || []),
            ankiType: card.anki_type || cardType,
            clozeText: card.cloze_text,
            front: card.front,
            back: card.back,
            explanation: card.explanation,
            mnemonic: card.mnemonic,
            clinicalPearl: card.clinical_pearl,
            references: JSON.stringify(card.references || []),
            pitfalls: card.pitfalls,
            imageDependent: card.image_dependent || false,
            seeAlso: JSON.stringify(card.see_also || []),
            rawJson: JSON.stringify(card),
          },
          update: {
            chapter: card.chapter,
            chapterId,
            sourceQNumber: card.source_q_number,
            difficulty: card.difficulty,
            tags: JSON.stringify(card.tags || []),
            ankiType: card.anki_type || cardType,
            clozeText: card.cloze_text,
            front: card.front,
            back: card.back,
            explanation: card.explanation,
            mnemonic: card.mnemonic,
            clinicalPearl: card.clinical_pearl,
            references: JSON.stringify(card.references || []),
            pitfalls: card.pitfalls,
            imageDependent: card.image_dependent || false,
            seeAlso: JSON.stringify(card.see_also || []),
            rawJson: JSON.stringify(card),
          },
        });
        savedCards.push(savedCard);
      } catch (dbError) {
        console.error("Failed to save card:", dbError);
      }
    }

    // Update progress if sequential
    if (updateProgress && isSequential) {
      const currentChapter = chapters.find(c => c.id === targetChapters[0]);
      const newQuestionNumber = (progress?.currentQuestionNumber || 0) + savedCards.length;
      const chapterComplete = currentChapter && newQuestionNumber >= (currentChapter.questionCount || 100);
      
      // Find next chapter if current is complete
      let nextChapterId = targetChapters[0];
      let nextQuestionNumber = newQuestionNumber;
      
      if (chapterComplete) {
        const currentIdx = chapters.findIndex(c => c.id === targetChapters[0]);
        if (currentIdx < chapters.length - 1) {
          nextChapterId = chapters[currentIdx + 1].id;
          nextQuestionNumber = 0;
        }
      }

      const allComplete = chapterComplete && nextChapterId === targetChapters[0];

      progress = await prisma.generationProgress.update({
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

    return NextResponse.json({
      success: true,
      generatedCount: cards.length,
      savedCount: savedCards.length,
      cards: savedCards,
      progress: progress ? {
        ...progress,
        extras: JSON.parse(progress.extras || "[]"),
      } : null,
    });
  } catch (error) {
    console.error("Generation error:", error);
    
    // Update progress with error
    try {
      await prisma.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "paused",
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
    } catch {}

    return NextResponse.json({ 
      error: "Failed to generate cards",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

function buildSystemPrompt(cardType: string, extras: string[]): string {
  const extraFieldsSchema = extras.map(id => {
    const map: Record<string, string> = {
      explanation: `    "explanation": "3–5 sentence mechanism + distractor analysis",`,
      mnemonic:    `    "mnemonic": "memorable mnemonic device",`,
      clinical:    `    "clinical_pearl": "one bedside insight",`,
      resources:   `    "references": ["Author et al. Journal. Year. doi:..."],`,
      ddx:         `    "pitfalls": "• Wrong A: reason\\n• Wrong B: reason\\n• Lookalike: scenario → answer",`,
    };
    return map[id] || "";
  }).filter(Boolean).join("\n");

  const clozeSchema = cardType !== "basic" ? `
    "cloze_text": "Full vignette + ALL answer choices visible. Answer line at bottom: The correct answer is {{c1::LETTER}} — {{c2::answer text}}.",` : "";

  const basicSchema = cardType !== "cloze" ? `
    "front": "Complete clinical vignette + all answer choices A–D exactly as in the textbook",
    "back": "<b>Answer X — [answer text]</b><br><br>Brief rationale (2–3 sentences). Why wrong answers fail.",` : "";

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

function extractChaptersFromContent(content: string): Array<{ id: number; label: string; startIdx: number; endIdx: number; questionCount: number }> {
  const lines = content.split("\n");
  const chapters: Array<{ id: number; label: string; startIdx: number; endIdx: number; questionCount: number }> = [];
  
  let currentChapter: { id: number; label: string; startIdx: number; endIdx: number; questionCount: number } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(/^(\d{1,2})\s+([A-Z][A-Za-z\s]{5,50})$/);
    
    if (match) {
      if (currentChapter) {
        currentChapter.endIdx = i;
        currentChapter.questionCount = countQuestionsInRange(lines, currentChapter.startIdx, currentChapter.endIdx);
        chapters.push(currentChapter);
      }
      currentChapter = {
        id: parseInt(match[1]),
        label: match[2].trim(),
        startIdx: i,
        endIdx: lines.length,
        questionCount: 0,
      };
    }
  }
  
  if (currentChapter) {
    currentChapter.endIdx = lines.length;
    currentChapter.questionCount = countQuestionsInRange(lines, currentChapter.startIdx, currentChapter.endIdx);
    chapters.push(currentChapter);
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 1,
      label: "Content",
      startIdx: 0,
      endIdx: lines.length,
      questionCount: countQuestionsInRange(lines, 0, lines.length),
    });
  }

  return chapters;
}

function countQuestionsInRange(lines: string[], startIdx: number, endIdx: number): number {
  let count = 0;
  for (let i = startIdx; i < endIdx && i < lines.length; i++) {
    if (lines[i].match(/^\d+\.\s+[A-Z]/)) {
      count++;
    }
  }
  return count;
}
