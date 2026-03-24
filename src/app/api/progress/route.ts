import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Get current generation progress
export async function GET() {
  try {
    // Get or create progress record
    let progress = await prisma.generationProgress.findUnique({
      where: { id: "main" },
    });

    if (!progress) {
      progress = await prisma.generationProgress.create({
        data: {
          id: "main",
          status: "idle",
        },
      });
    }

    const sourceFile = await prisma.sourceFile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const cardsCount = await prisma.ankiCard.count();

    return NextResponse.json({
      progress: {
        ...progress,
        extras: JSON.parse(progress.extras || "[]"),
      },
      sourceFile: sourceFile ? {
        id: sourceFile.id,
        filename: sourceFile.filename,
        chapters: JSON.parse(sourceFile.chapters || "[]"),
        totalQuestions: sourceFile.totalQuestions,
      } : null,
      cardsCount,
    });
  } catch (error) {
    console.error("Get progress error:", error);
    return NextResponse.json({ 
      error: "Failed to get progress",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// PUT - Update generation settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize, cardType, extras, status } = body;

    const updateData: Record<string, unknown> = {};
    if (batchSize !== undefined) updateData.batchSize = batchSize;
    if (cardType !== undefined) updateData.cardType = cardType;
    if (extras !== undefined) updateData.extras = JSON.stringify(extras);
    if (status !== undefined) updateData.status = status;

    const progress = await prisma.generationProgress.upsert({
      where: { id: "main" },
      create: {
        id: "main",
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    console.error("Update progress error:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}

// POST - Control generation (start, pause, reset)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Ensure progress record exists
    let progress = await prisma.generationProgress.findUnique({
      where: { id: "main" },
    });
    
    if (!progress) {
      progress = await prisma.generationProgress.create({
        data: { id: "main", status: "idle" },
      });
    }

    if (action === "reset") {
      progress = await prisma.generationProgress.update({
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
      progress = await prisma.generationProgress.update({
        where: { id: "main" },
        data: { status: "paused" },
      });
      return NextResponse.json({ success: true, progress });
    }

    if (action === "start") {
      progress = await prisma.generationProgress.update({
        where: { id: "main" },
        data: {
          status: "running",
          startedAt: progress.startedAt || new Date(),
        },
      });
      return NextResponse.json({ success: true, progress });
    }

    if (action === "complete") {
      progress = await prisma.generationProgress.update({
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
    console.error("Control progress error:", error);
    return NextResponse.json({ error: "Failed to control progress" }, { status: 500 });
  }
}
