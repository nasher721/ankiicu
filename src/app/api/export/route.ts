import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clampInt, EXPORT_FETCH_BATCH, MAX_LIST_LIMIT } from "@/lib/api-limits";
import { serverErrorResponse } from "@/lib/api-errors";
import { safeJsonArray } from "@/lib/json-safe";
import type { AnkiCard } from "@prisma/client";
import type { Prisma } from "@prisma/client";

async function loadCardsForExport(
  where: Prisma.AnkiCardWhereInput,
  limitParam: string | null,
  offsetParam: string | null,
): Promise<AnkiCard[]> {
  if (limitParam != null && limitParam !== "") {
    const limit = clampInt(limitParam, 1, MAX_LIST_LIMIT, MAX_LIST_LIMIT);
    const offset = Math.max(0, clampInt(offsetParam, 0, MAX_LIST_LIMIT * 100, 0));
    return db.ankiCard.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    });
  }

  const out: AnkiCard[] = [];
  let skip = 0;
  for (;;) {
    const batch = await db.ankiCard.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: EXPORT_FETCH_BATCH,
      skip,
    });
    out.push(...batch);
    if (batch.length < EXPORT_FETCH_BATCH) break;
    skip += EXPORT_FETCH_BATCH;
  }
  return out;
}

// GET - Export cards as JSON or CSV
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";
    const cardType = searchParams.get("cardType");

    const whereClause = cardType ? { ankiType: cardType } : {};

    const cards = await loadCardsForExport(
      whereClause,
      searchParams.get("limit"),
      searchParams.get("offset"),
    );

    if (format === "csv") {
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
        "ddx",
      ];

      const escapeCSV = (str: string | null) => {
        if (!str) return "";
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(","),
        ...cards.map((card) =>
          [
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
            escapeCSV(card.ddx),
          ].join(","),
        ),
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=neurocritical_care_anki.csv",
          "X-Card-Count": String(cards.length),
        },
      });
    }

    const jsonCards = cards.map((card) => {
      try {
        return JSON.parse(card.rawJson || "{}");
      } catch {
        return {
          id: card.cardId,
          chapter: card.chapter,
          source_q_number: card.sourceQNumber,
          difficulty: card.difficulty,
          tags: safeJsonArray(card.tags, []),
          anki_type: card.ankiType,
          cloze_text: card.clozeText,
          front: card.front,
          back: card.back,
          explanation: card.explanation,
          mnemonic: card.mnemonic,
          clinical_pearl: card.clinicalPearl,
          references: safeJsonArray(card.references, []),
          pitfalls: card.pitfalls,
          ddx: card.ddx,
          image_dependent: card.imageDependent,
          see_also: safeJsonArray(card.seeAlso, []),
        };
      }
    });

    return new NextResponse(JSON.stringify(jsonCards, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=neurocritical_care_anki.json",
        "X-Card-Count": String(cards.length),
      },
    });
  } catch (error) {
    return serverErrorResponse("Failed to export cards", error);
  }
}
