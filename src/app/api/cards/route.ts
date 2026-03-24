import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Retrieve all cards
export async function GET() {
  try {
    const cards = await prisma.ankiCard.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
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

    const savedCards = [];
    
    for (const card of cards) {
      // Skip metadata objects
      if (card._meta) continue;

      const savedCard = await prisma.ankiCard.upsert({
        where: { cardId: card.id },
        create: {
          cardId: card.id,
          chapter: card.chapter,
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
      cards: savedCards 
    });
  } catch (error) {
    console.error("Error saving cards:", error);
    return NextResponse.json({ error: "Failed to save cards" }, { status: 500 });
  }
}

// DELETE - Delete all cards
export async function DELETE() {
  try {
    await prisma.ankiCard.deleteMany();
    return NextResponse.json({ success: true, message: "All cards deleted" });
  } catch (error) {
    console.error("Error deleting cards:", error);
    return NextResponse.json({ error: "Failed to delete cards" }, { status: 500 });
  }
}
