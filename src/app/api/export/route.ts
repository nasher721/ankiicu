import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Export cards as JSON or CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const cardType = searchParams.get("cardType"); // cloze, basic, or undefined for all

    const whereClause = cardType ? { ankiType: cardType } : {};
    
    const cards = await prisma.ankiCard.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
    });

    if (format === "csv") {
      // Generate CSV for Anki import
      const headers = [
        "id",
        "chapter",
        "difficulty",
        "tags",
        "anki_type",
        "cloze_text",
        "front",
        "back",
        "explanation",
        "mnemonic",
        "clinical_pearl",
        "references",
        "pitfalls",
      ];

      const escapeCSV = (str: string | null) => {
        if (!str) return "";
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(","),
        ...cards.map(card => [
          escapeCSV(card.cardId),
          escapeCSV(card.chapter),
          escapeCSV(card.difficulty),
          escapeCSV(card.tags),
          escapeCSV(card.ankiType),
          escapeCSV(card.clozeText),
          escapeCSV(card.front),
          escapeCSV(card.back),
          escapeCSV(card.explanation),
          escapeCSV(card.mnemonic),
          escapeCSV(card.clinicalPearl),
          escapeCSV(card.references),
          escapeCSV(card.pitfalls),
        ].join(",")),
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=neurocritical_care_anki.csv",
        },
      });
    }

    // Default: JSON format
    const jsonCards = cards.map(card => {
      try {
        return JSON.parse(card.rawJson || "{}");
      } catch {
        return {
          id: card.cardId,
          chapter: card.chapter,
          source_q_number: card.sourceQNumber,
          difficulty: card.difficulty,
          tags: JSON.parse(card.tags || "[]"),
          anki_type: card.ankiType,
          cloze_text: card.clozeText,
          front: card.front,
          back: card.back,
          explanation: card.explanation,
          mnemonic: card.mnemonic,
          clinical_pearl: card.clinicalPearl,
          references: JSON.parse(card.references || "[]"),
          pitfalls: card.pitfalls,
          image_dependent: card.imageDependent,
          see_also: JSON.parse(card.seeAlso || "[]"),
        };
      }
    });

    return new NextResponse(JSON.stringify(jsonCards, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=neurocritical_care_anki.json",
      },
    });
  } catch (error) {
    console.error("Error exporting cards:", error);
    return NextResponse.json({ error: "Failed to export cards" }, { status: 500 });
  }
}
