export type DetectedChapter = {
  id: number;
  label: string;
  startIdx: number;
  endIdx: number;
  questionCount: number;
};

function stripMarkdownFormatting(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function looksLikeQuestionStem(line: string): boolean {
  const t = line.trim();
  if (/^\d+\.\s+[A-Z]\s+\d/.test(t)) return true;
  if (
    /^\d+\.\s+[A-Z]\s+(year-old|yo|woman|man|male|female|patient|presents|presenting)\b/i.test(t)
  )
    return true;
  if (/^\d+\.\s+[A-D][.)]\s/.test(t)) return true;
  if (/\d+\s*(year|yo|day|week|month)[- ]old/i.test(t)) return true;
  return false;
}

function tryParseChapterLabel(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const dehashed = trimmed.replace(/^#{1,6}\s+/, "");

  const chWord = dehashed.match(/^(?:Chapter|CHAPTER)\s+(\d{1,3})(?:\s*[:-–—]\s*|\s+)(.*)$/);
  if (chWord) {
    const titlePart = stripMarkdownFormatting((chWord[2] || "").trim());
    if (titlePart.length >= 2) return `Ch. ${chWord[1]}: ${titlePart}`;
    return `Chapter ${chWord[1]}`;
  }

  const num = dehashed.match(/^(\d{1,3})[.)]\s+(.+)$/);
  if (num) {
    if (looksLikeQuestionStem(trimmed)) return null;
    let title = stripMarkdownFormatting(num[2].trim());
    title = title.replace(/\s*#+\s*$/, "").trim();
    if (title.length < 2) return null;
    if (title.length > 200) title = `${title.slice(0, 197)}...`;
    return title;
  }

  if (/^#{1,3}\s+/.test(trimmed)) {
    const title = stripMarkdownFormatting(dehashed.trim());
    if (title.length >= 3 && title.length <= 150 && !looksLikeQuestionStem(trimmed)) {
      return title;
    }
  }

  return null;
}

export function countQuestionsInRange(
  lines: string[],
  startIdx: number,
  endIdx: number,
): number {
  let count = 0;
  for (let i = startIdx; i < endIdx && i < lines.length; i++) {
    const raw = lines[i];
    if (/^\d+\.\s+[A-Z]/.test(raw)) count++;
    else if (/^\d+\)\s+[A-Z]/.test(raw.trim())) count++;
  }
  return count;
}

export function detectChapters(content: string): DetectedChapter[] {
  const lines = content.split("\n");
  const chapters: DetectedChapter[] = [];
  let current: DetectedChapter | null = null;
  let nextId = 1;

  for (let i = 0; i < lines.length; i++) {
    const label = tryParseChapterLabel(lines[i]);
    if (label) {
      if (current) {
        current.endIdx = i;
        current.questionCount = countQuestionsInRange(
          lines,
          current.startIdx,
          current.endIdx,
        );
        chapters.push(current);
      }
      current = {
        id: nextId++,
        label,
        startIdx: i,
        endIdx: lines.length,
        questionCount: 0,
      };
    }
  }

  if (current) {
    current.endIdx = lines.length;
    current.questionCount = countQuestionsInRange(
      lines,
      current.startIdx,
      current.endIdx,
    );
    chapters.push(current);
  }

  if (chapters.length === 0) {
    chapters.push({
      id: 1,
      label: "Content",
      startIdx: 0,
      endIdx: lines.length,
      questionCount: countQuestionsInRange(lines, 0, lines.length),
    });
  }

  return chapters;
}

/** DB stores null = all chapters; non-null JSON array = filter to these ordered ids (must exist). */
export function resolveIncludedChapterIds(
  chapters: { id: number }[],
  stored: string | null | undefined,
): number[] {
  const allIds = chapters.map((c) => c.id);
  if (stored == null || stored === "") return allIds;
  try {
    const v = JSON.parse(stored) as unknown;
    if (!Array.isArray(v)) return allIds;
    const nums = v.filter((x): x is number => typeof x === "number" && Number.isInteger(x));
    if (nums.length === 0) return allIds;
    const set = new Set(nums);
    const resolved = allIds.filter((id) => set.has(id));
    return resolved.length > 0 ? resolved : allIds;
  } catch {
    return allIds;
  }
}

export function sumQuestionTargetForIds(
  chapters: DetectedChapter[],
  includedIds: number[],
): number {
  const set = new Set(includedIds);
  return chapters.filter((c) => set.has(c.id)).reduce((s, c) => s + c.questionCount, 0);
}
