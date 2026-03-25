import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clampInt, MAX_BATCH_SIZE, MIN_BATCH_SIZE } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import { extrasFromStoredProgress, migrateLegacyGenerationExtraIds } from "@/lib/generation-extras";
import {
  resolveIncludedChapterIds,
  sumQuestionTargetForIds,
  type DetectedChapter,
} from "@/lib/chapters";

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
        extras: extrasFromStoredProgress(progress.extras),
        includedChapterIds:
          progress.includedChapterIds === null || progress.includedChapterIds === ""
            ? null
            : safeJsonArray(progress.includedChapterIds, [] as number[]),
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
    const { batchSize, cardType, extras, status, currentChapterId, includedChapterIds } = body;

    const updateData: Record<string, unknown> = {};
    if (batchSize !== undefined) {
      updateData.batchSize = clampInt(batchSize, MIN_BATCH_SIZE, MAX_BATCH_SIZE, 5);
    }
    if (cardType !== undefined) updateData.cardType = cardType;
    if (extras !== undefined) {
      updateData.extras = JSON.stringify(
        Array.isArray(extras) ? migrateLegacyGenerationExtraIds(extras as string[]) : extras,
      );
    }
    if (status !== undefined) updateData.status = status;

    if (includedChapterIds !== undefined) {
      if (includedChapterIds === null) {
        updateData.includedChapterIds = null;
      } else if (Array.isArray(includedChapterIds)) {
        const ids = includedChapterIds
          .map((n: unknown) => Number(n))
          .filter((n) => Number.isInteger(n) && n > 0);
        updateData.includedChapterIds = JSON.stringify(ids);
      }
    }

    let nextChapterId: number | undefined;
    if (currentChapterId !== undefined) {
      nextChapterId = clampInt(currentChapterId, 1, 99999, 1);
      updateData.currentChapterId = nextChapterId;
    }

    const progress = await db.generationProgress.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        ...updateData,
      },
      update: updateData,
    });

    const sourceFile = await db.sourceFile.findFirst({
      orderBy: { createdAt: "desc" },
    });
    let finalProgress = progress;
    const touchChapters = includedChapterIds !== undefined || currentChapterId !== undefined;

    if (touchChapters && sourceFile?.chapters) {
      const chs = safeJsonArray(sourceFile.chapters, []) as DetectedChapter[];
      if (chs.length > 0) {
        const resolvedIncluded = resolveIncludedChapterIds(chs, progress.includedChapterIds);
        let cid = progress.currentChapterId;
        if (!resolvedIncluded.includes(cid)) {
          cid = resolvedIncluded[0] ?? chs[0]?.id ?? 1;
        }
        const targetSum = sumQuestionTargetForIds(chs, resolvedIncluded);
        finalProgress = await db.generationProgress.update({
          where: { id: "main" },
          data: {
            currentChapterId: cid,
            totalQuestionsTarget: targetSum,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      progress: {
        ...finalProgress,
        extras: extrasFromStoredProgress(finalProgress.extras),
        includedChapterIds:
          finalProgress.includedChapterIds === null ||
          finalProgress.includedChapterIds === ""
            ? null
            : safeJsonArray(finalProgress.includedChapterIds, [] as number[]),
      },
    });
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
      const sf = await db.sourceFile.findFirst({ orderBy: { createdAt: "desc" } });
      const chs = sf ? (safeJsonArray(sf.chapters, []) as DetectedChapter[]) : [];
      const firstId = chs[0]?.id ?? 1;
      const totalQ = sf?.totalQuestions ?? 0;

      progress = await db.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "idle",
          currentChapterId: firstId,
          currentQuestionNumber: 0,
          totalCardsGenerated: 0,
          totalQuestionsTarget: totalQ,
          includedChapterIds: null,
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
