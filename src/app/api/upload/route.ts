import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST - Upload a file (PDF content as text or markdown)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name;
    const fileType = filename.endsWith(".md") ? "md" : filename.endsWith(".pdf") ? "pdf" : "txt";
    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }

    // Detect chapters in the content
    const chapters = detectChapters(content);

    // Store the file in database
    const sourceFile = await prisma.sourceFile.create({
      data: {
        filename,
        fileType,
        content,
        chapters: JSON.stringify(chapters),
        totalQuestions: chapters.reduce((sum, ch) => sum + ch.questionCount, 0),
      },
    });

    // Reset/update generation progress with new file
    await prisma.generationProgress.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        sourceFileId: sourceFile.id,
        status: "idle",
        currentChapterId: chapters[0]?.id || 1,
        currentQuestionNumber: 0,
        totalCardsGenerated: 0,
        totalQuestionsTarget: sourceFile.totalQuestions,
      },
      update: {
        sourceFileId: sourceFile.id,
        status: "idle",
        currentChapterId: chapters[0]?.id || 1,
        currentQuestionNumber: 0,
        totalCardsGenerated: 0,
        totalQuestionsTarget: sourceFile.totalQuestions,
        lastError: null,
        startedAt: null,
        completedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      file: {
        id: sourceFile.id,
        filename: sourceFile.filename,
        chapters,
        totalQuestions: sourceFile.totalQuestions,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: "Failed to upload file",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// GET - Get current source file info
export async function GET() {
  try {
    const sourceFile = await prisma.sourceFile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!sourceFile) {
      return NextResponse.json({ file: null });
    }

    return NextResponse.json({
      file: {
        id: sourceFile.id,
        filename: sourceFile.filename,
        fileType: sourceFile.fileType,
        chapters: JSON.parse(sourceFile.chapters),
        totalQuestions: sourceFile.totalQuestions,
        processed: sourceFile.processed,
        createdAt: sourceFile.createdAt,
      },
    });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json({ error: "Failed to get file info" }, { status: 500 });
  }
}

// DELETE - Delete source file
export async function DELETE() {
  try {
    await prisma.sourceFile.deleteMany();
    await prisma.generationProgress.updateMany({
      data: {
        sourceFileId: null,
        status: "idle",
        currentChapterId: 1,
        currentQuestionNumber: 0,
        totalCardsGenerated: 0,
        totalQuestionsTarget: 0,
        lastError: null,
        startedAt: null,
        completedAt: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}

// Helper function to detect chapters
function detectChapters(content: string): Array<{ id: number; label: string; startIdx: number; endIdx: number; questionCount: number }> {
  const lines = content.split("\n");
  const chapters: Array<{ id: number; label: string; startIdx: number; endIdx: number; questionCount: number }> = [];
  
  let currentChapter: { id: number; label: string; startIdx: number; endIdx: number; questionCount: number } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for numbered chapters (e.g., "1 CNS Ischemia" or "1. CNS Ischemia")
    const match = line.match(/^(\d{1,2})[.\s]+([A-Z][A-Za-z\s]{3,40})$/);
    
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

  // If no chapters found, create a default one
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
    // Match numbered questions like "1.", "2.", etc. at start of line
    if (lines[i].match(/^\d+\.\s+[A-Z]/)) {
      count++;
    }
  }
  return count;
}
