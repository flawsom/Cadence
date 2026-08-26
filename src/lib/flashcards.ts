/**
 * Flashcard generation from Cadence's practice problems.
 * Produces Anki-compatible TSV files (tab-separated, one card per line).
 *
 * Format: Front<TAB>Back<TAB>Tags
 * - Front: the practice problem / challenge question
 * - Back: model answer + key concepts + difficulty
 * - Tags: topic name, level, plan name
 */

import { evaluateOffline } from "@/convex/evaluateOffline";

interface FlashcardInput {
  planTitle: string;
  topics: {
    title: string;
    level: number;
    practice?: string[];
    challenge?: string;
  }[];
}

interface Flashcard {
  front: string;
  back: string;
  tags: string[];
}

const LEVEL_NAMES: Record<number, string> = {
  1: "Foundations",
  2: "Core",
  3: "Advanced",
};

/**
 * Generate flashcards from a plan's topics and practice problems.
 */
export function generateFlashcards(input: FlashcardInput): Flashcard[] {
  const cards: Flashcard[] = [];
  const planTag = input.planTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);

  for (const topic of input.topics) {
    const levelName = LEVEL_NAMES[topic.level] ?? "General";
    const topicTag = topic.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const tags = [planTag, topicTag, levelName];

    // Practice problem cards
    if (topic.practice) {
      for (const problem of topic.practice) {
        const evaluation = evaluateOffline(problem, "");
        const back = formatCardBack(problem, evaluation.improvedAnswer ?? "", topic.title);
        cards.push({ front: problem, back, tags });
      }
    }

    // Challenge card (harder, more comprehensive)
    if (topic.challenge) {
      const evaluation = evaluateOffline(topic.challenge, "");
      const back = formatCardBack(
        topic.challenge,
        evaluation.improvedAnswer ?? "",
        topic.title,
      );
      cards.push({
        front: `🏆 CHALLENGE: ${topic.challenge}`,
        back,
        tags: [...tags, "Challenge"],
      });
    }
  }

  return cards;
}

function formatCardBack(
  problem: string,
  modelAnswer: string,
  topicTitle: string,
): string {
  const lines: string[] = [];

  // Model answer
  if (modelAnswer) {
    // Strip markdown formatting for plain text flashcard
    const plain = modelAnswer
      .replace(/\*\*/g, "")
      .replace(/\n\n+/g, "\n")
      .trim();
    lines.push(plain);
  }

  // Topic context
  lines.push("");
  lines.push(`📚 Topic: ${topicTitle}`);

  return lines.join("\n");
}

/**
 * Convert flashcards to Anki-compatible TSV string.
 * Anki expects: front\tback\ttags (one card per line)
 */
export function toAnkiTSV(cards: Flashcard[]): string {
  const header = "#separator:tab\n#html:false\n#tags column:3\n";
  const rows = cards.map((card) => {
    const front = card.front.replace(/\t/g, " ").replace(/\n/g, "<br>");
    const back = card.back.replace(/\t/g, " ").replace(/\n/g, "<br>");
    const tags = card.tags.join(" ");
    return `${front}\t${back}\t${tags}`;
  });
  return header + rows.join("\n") + "\n";
}

/**
 * Convert flashcards to CSV string (alternative format).
 */
export function toCSV(cards: Flashcard[]): string {
  const rows = cards.map((card) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      escape(card.front),
      escape(card.back),
      escape(card.tags.join(" ")),
    ].join(",");
  });
  return "Front,Back,Tags\n" + rows.join("\n") + "\n";
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
