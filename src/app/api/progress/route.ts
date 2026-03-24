import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clampInt, MAX_BATCH_SIZE, MIN_BATCH_SIZE } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";

// GET - Get current generation progress
export async function GET() {
  try {
    let progress = await db.generationProgress.findUnique({
      where: { id: "main" },
    });

    if (!progress) {
      progress = await db.generationProgress.create({
        data: {
          id: "main",
          status: "idle",
        },
      });
    }

    const sourceFile = await db.sourceFile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const cardsCount = await db.ankiCard.count();

    return NextResponse.json({
      progress: {
        ...progress,
        extras: safeJsonArray(progress.extras, []),
      },
      sourceFile: sourceFile
        ? {
            id: sourceFile.id,
            filename: sourceFile.filename,
            chapters: safeJsonArray(sourceFile.chapters, []),
            totalQuestions: sourceFile.totalQuestions,
          }
        : null,
      cardsCount,
    });
  } catch (error) {
    return serverErrorResponse("Failed to get progress", error);
  }
}

// PUT - Update generation settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize, cardType, extras, status } = body;

    const updateData: Record<string, unknown> = {};
    if (batchSize !== undefined) {
      updateData.batchSize = clampInt(batchSize, MIN_BATCH_SIZE, MAX_BATCH_SIZE, 5);
    }
    if (cardType !== undefined) updateData.cardType = cardType;
    if (extras !== undefined) updateData.extras = JSON.stringify(extras);
    if (status !== undefined) updateData.status = status;

    const progress = await db.generationProgress.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    return serverErrorResponse("Failed to update progress", error);
  }
}

// POST - Control generation (start, pause, reset)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let progress = await db.generationProgress.findUnique({
      where: { id: "main" },
    });

    if (!progress) {
      progress = await db.generationProgress.create({
        data: { id: "main", status: "idle" },
      });
    }

    if (action === "reset") {
      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "idle",
          currentChapterId: 1,
          currentQuestionNumber: 0,
          totalCardsGenerated: 0,
          lastError: null,
          startedAt: null,
          completedAt: null,
        },
      });
      return NextResponse.json({ success: true, progress });
    }

    if (action === "pause") {
      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: { status: "paused" },
      });
      return NextResponse.json({ success: true, progress });
    }

    if (action === "start") {
      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "running",
          startedAt: progress.startedAt || new Date(),
        },
      });
      return NextResponse.json({ success: true, progress });
    }

    if (action === "complete") {
      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, progress });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return serverErrorResponse("Failed to control progress", error);
  }
}
