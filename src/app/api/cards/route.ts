import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clampInt,
  DEFAULT_LIST_LIMIT,
  MAX_CARDS_PER_REQUEST,
  MAX_LIST_LIMIT,
} from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import type { AnkiCard } from "@prisma/client";

// GET - Retrieve cards (paginated)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = clampInt(
      searchParams.get("limit"),
      1,
      MAX_LIST_LIMIT,
      DEFAULT_LIST_LIMIT,
    );
    const offset = Math.max(0, clampInt(searchParams.get("offset"), 0, MAX_LIST_LIMIT * 100, 0));

    const [cards, total] = await Promise.all([
      db.ankiCard.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.ankiCard.count(),
    ]);

    return NextResponse.json({ cards, total, limit, offset });
  } catch (error) {
    return serverErrorResponse("Failed to fetch cards", error);
  }
}

// POST - Save cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cards } = body;

    if (!Array.isArray(cards)) {
      return NextResponse.json({ error: "Cards must be an array" }, { status: 400 });
    }

    if (cards.length > MAX_CARDS_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many cards (max ${MAX_CARDS_PER_REQUEST} per request)` },
        { status: 400 },
      );
    }

    const savedCards: AnkiCard[] = [];

    for (const card of cards) {
      if (card._meta) continue;
      const cardId =
        typeof card.id === "string" && card.id.length > 0
          ? card.id
          : `import_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const savedCard = await db.ankiCard.upsert({
        where: { cardId },
        create: {
          cardId,
          chapter: card.chapter ?? "Unknown",
          chapterId: typeof card.chapter_id === "number" ? card.chapter_id : 0,
          sourceQNumber: card.source_q_number || 0,
          difficulty: card.difficulty || "medium",
          tags: JSON.stringify(card.tags || []),
          ankiType: card.anki_type || "cloze",
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
          sourceQNumber: card.source_q_number,
          difficulty: card.difficulty,
          tags: JSON.stringify(card.tags || []),
          ankiType: card.anki_type,
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
    }

    return NextResponse.json({
      success: true,
      count: savedCards.length,
      cards: savedCards,
    });
  } catch (error) {
    return serverErrorResponse("Failed to save cards", error);
  }
}

// DELETE - Delete all cards or single card by ID
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await db.ankiCard.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: "Card deleted" });
    }
    await db.ankiCard.deleteMany();
    return NextResponse.json({ success: true, message: "All cards deleted" });
  } catch (error) {
    return serverErrorResponse("Failed to delete cards", error);
  }
}
