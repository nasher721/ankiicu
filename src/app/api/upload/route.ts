import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import { detectChapters } from "@/lib/chapters";

// POST - Upload a file (PDF content as text or markdown)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)` },
        { status: 413 },
      );
    }

    const filename = file.name || "unknown.txt";
    const fileType = filename.endsWith(".md") ? "md" : filename.endsWith(".pdf") ? "pdf" : "txt";
    const rawContent = await file.text();
    
    // PostgreSQL strict text encoding forbids null bytes (\0, \x00).
    // Exported PDF text often retains hidden null bytes, making Prisma/Postgres crash.
    const content = rawContent.replace(/\0/g, "");

    if (!content.trim()) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }

    if (content.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Decoded content too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB)` },
        { status: 413 },
      );
    }

    const chapters = detectChapters(content);

    const sourceFile = await db.$transaction(async (tx) => {
      const sf = await tx.sourceFile.create({
        data: {
          filename,
          fileType,
          content,
          chapters: JSON.stringify(chapters),
          totalQuestions: chapters.reduce((sum, ch) => sum + ch.questionCount, 0),
        },
      });
      await tx.generationProgress.upsert({
        where: { id: "main" },
        create: {
          id: "main",
          sourceFileId: sf.id,
          status: "idle",
          currentChapterId: chapters[0]?.id || 1,
          currentQuestionNumber: 0,
          totalCardsGenerated: 0,
          totalQuestionsTarget: sf.totalQuestions,
          includedChapterIds: null,
        },
        update: {
          sourceFileId: sf.id,
          status: "idle",
          currentChapterId: chapters[0]?.id || 1,
          currentQuestionNumber: 0,
          totalCardsGenerated: 0,
          totalQuestionsTarget: sf.totalQuestions,
          includedChapterIds: null,
          lastError: null,
          startedAt: null,
          completedAt: null,
        },
      });
      return sf;
    });

    return NextResponse.json({
      success: true,
      file: {
        id: sourceFile.id,
        filename: sourceFile.filename,
        fileType: sourceFile.fileType,
        chapters,
        totalQuestions: sourceFile.totalQuestions,
        processed: sourceFile.processed,
        createdAt: sourceFile.createdAt,
      },
    });
  } catch (error) {
    return serverErrorResponse("Failed to upload file", error);
  }
}

// GET - Get current source file info
export async function GET() {
  try {
    const sourceFile = await db.sourceFile.findFirst({
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
        chapters: safeJsonArray(sourceFile.chapters, []),
        totalQuestions: sourceFile.totalQuestions,
        processed: sourceFile.processed,
        createdAt: sourceFile.createdAt,
      },
    });
  } catch (error) {
    return serverErrorResponse("Failed to get file info", error);
  }
}

// DELETE - Delete source file
export async function DELETE() {
  try {
    await db.sourceFile.deleteMany();
    await db.generationProgress.updateMany({
      data: {
        sourceFileId: null,
        status: "idle",
        currentChapterId: 1,
        currentQuestionNumber: 0,
        totalCardsGenerated: 0,
        totalQuestionsTarget: 0,
        includedChapterIds: null,
        lastError: null,
        startedAt: null,
        completedAt: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse("Failed to delete file", error);
  }
}

