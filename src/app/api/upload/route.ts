import { NextRequest, NextResponse } from "next/server";
import { Prisma, type SourceFile } from "@prisma/client";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import { detectChapters } from "@/lib/chapters";
import { apiAuthOr401 } from "@/lib/api-auth";
import { bytesToUploadText, isContentWithinByteLimit } from "@/lib/upload-extract";

export const runtime = "nodejs";
/** Allow large textbook writes (platform may clamp, e.g. Vercel Hobby ~10s). */
export const maxDuration = 120;

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
    const totalQuestions = chapters.reduce((sum, ch) => sum + ch.questionCount, 0);

    // Avoid interactive $transaction: Neon's pooled DATABASE_URL (PgBouncer) often cannot
    // reliably hold an interactive transaction across round-trips, which surfaces as a
    // generic "Failed to upload file" even though each statement would succeed alone.
    const sourceFile = await (async (): Promise<SourceFile> => {
      let created: SourceFile | undefined;
      try {
        created = await db.sourceFile.create({
          data: {
            filename,
            fileType,
            content,
            chapters: JSON.stringify(chapters),
            totalQuestions,
          },
        });
        await db.generationProgress.upsert({
          where: { id: "main" },
          create: {
            id: "main",
            sourceFileId: created.id,
            status: "idle",
            currentChapterId: chapters[0]?.id || 1,
            currentQuestionNumber: 0,
            totalCardsGenerated: 0,
            totalQuestionsTarget: created.totalQuestions,
            includedChapterIds: null,
          },
          update: {
            sourceFileId: created.id,
            status: "idle",
            currentChapterId: chapters[0]?.id || 1,
            currentQuestionNumber: 0,
            totalCardsGenerated: 0,
            totalQuestionsTarget: created.totalQuestions,
            includedChapterIds: null,
            lastError: null,
            startedAt: null,
            completedAt: null,
          },
        });
        return created;
      } catch (persistErr) {
        if (created?.id) {
          await db.sourceFile.delete({ where: { id: created.id } }).catch(() => {});
        }
        throw persistErr;
      }
    })();

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
    const msg = error instanceof Error ? error.message : "";

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Upload Prisma error", error.code, error.message, error.meta);
      const hints: Record<string, string> = {
        P1001:
          "Could not reach the database. Check DATABASE_URL and that your provider allows connections from Vercel (IP allowlist, etc.).",
        P1008:
          "Database operation timed out. Try a smaller file or a database plan with higher timeouts.",
        P1017:
          "Database server closed the connection. Retry; with serverless Postgres use a pooler URL intended for Prisma.",
        P2022:
          "The database schema is out of date (a column Prisma expects is missing). Run `npx prisma migrate deploy` against this DATABASE_URL, or redeploy so the build runs migrations.",
        P2024: "Connection pool timed out. Retry or increase pool size / use Neon's pooled connection string.",
        P2034: "Write conflict or deadlock. Retry the upload.",
      };
      const p2022Column =
        error.code === "P2022" && error.meta && typeof (error.meta as { column?: unknown }).column === "string"
          ? String((error.meta as { column: string }).column)
          : null;
      return NextResponse.json(
        {
          error: hints[error.code] ?? "Could not save the file to the database.",
          code: error.code,
          ...(process.env.NODE_ENV !== "production"
            ? { details: error.message }
            : p2022Column
              ? { details: `Missing column: ${p2022Column}` }
              : {}),
        },
        { status: 500 },
      );
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("Upload Prisma validation", error.message);
      return NextResponse.json(
        {
          error: "Invalid data when saving the upload.",
          ...(process.env.NODE_ENV !== "production" ? { details: error.message } : {}),
        },
        { status: 400 },
      );
    }

    if (/timeout|timed out|Transaction.*closed/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Saving the file timed out. Try again, use a smaller export, or check your database/network (large books need a longer DB write).",
        },
        { status: 503 },
      );
    }

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

    const limits = { maxUploadBytes: MAX_UPLOAD_BYTES };

    if (!sourceFile) {
      return NextResponse.json({ file: null, limits });
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
      limits,
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
