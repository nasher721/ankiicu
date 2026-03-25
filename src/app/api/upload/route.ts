import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import { detectChapters } from "@/lib/chapters";
import { apiAuthOr401 } from "@/lib/api-auth";
import { bytesToUploadText, isContentWithinByteLimit } from "@/lib/upload-extract";

export const runtime = "nodejs";

// POST - Upload a file (binary PDF, or text / markdown)
export async function POST(request: NextRequest) {
  try {
    const auth = await apiAuthOr401(request);
    if (auth) return auth;

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
    const buf = await file.arrayBuffer();
    let content: string;
    let fileType: "pdf" | "md" | "txt";
    try {
      const extracted = await bytesToUploadText(buf, filename);
      content = extracted.content;
      fileType = extracted.fileType;
    } catch (err) {
      console.error("Upload decode/PDF extract failed", err);
      return NextResponse.json(
        {
          error:
            "Could not read this file. For PDFs, ensure the file is a standard (non-corrupt) PDF. You can also export extracted text as .md or .txt.",
        },
        { status: 400 },
      );
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: "Empty content after reading the file (PDF may be image-only or encrypted)." },
        { status: 400 },
      );
    }

    if (!isContentWithinByteLimit(content, MAX_UPLOAD_BYTES)) {
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
export async function GET(request: NextRequest) {
  try {
    const auth = await apiAuthOr401(request);
    if (auth) return auth;

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
export async function DELETE(request: NextRequest) {
  try {
    const auth = await apiAuthOr401(request);
    if (auth) return auth;

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
