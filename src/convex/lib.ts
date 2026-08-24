// Shared server-side helpers for the Cadence engine.
// Pure TypeScript — safe to import from any Convex function.

export type ParsedTopic = { title: string; hours: number; level: number };

const DAY_MS = 86_400_000;

export function dayKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function utcMsToDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDaysToDayKey(key: string, n: number): string {
  return utcMsToDayKey(dayKeyToUtcMs(key) + n * DAY_MS);
}

const LEVEL_WORDS: [RegExp, number][] = [
  [/\b(intro|introduction|basic|basics|fundamental|foundation|principle|getting started|overview|orientation)\b/i, 1],
  [/\b(intermediate|applied|practice|practicum|technique|workshop|lab|core|method|tooling)\b/i, 2],
  [/\b(advanced|expert|deep|mastery|capstone|specialized|optimi[sz]ation|architecture|research|seminar)\b/i, 3],
];

function levelFor(title: string, positionRatio: number): number {
  for (const [re, level] of LEVEL_WORDS) {
    if (re.test(title)) return level;
  }
  if (positionRatio < 0.34) return 1;
  if (positionRatio < 0.7) return 2;
  return 3;
}

function hoursFor(title: string): number {
  const words = title.split(/\s+/).length;
  const raw = words <= 5 ? 1.5 : words <= 10 ? 2 : words <= 16 ? 2.5 : 3;
  return Math.min(4, raw);
}

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*\u2022\u00b7\u2013\u2014]+)\s*/, "")
    .replace(/^\s*\d+(?:\.\d+)*\s*[.)\]:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic fallback parser: real sequencing, no AI required. */
export function heuristicParse(raw: string): {
  title: string;
  topics: ParsedTopic[];
} {
  const cleaned = raw.replace(/\r/g, "").trim();

  const lines = cleaned
    .split("\n")
    .map(cleanLine)
    .filter((l) => l.length > 1)
    .slice(0, 40);

  if (lines.length >= 3) {
    const topics = lines.map((title, i) => ({
      title: title.slice(0, 120),
      hours: hoursFor(title),
      level: levelFor(title, lines.length > 1 ? i / (lines.length - 1) : 0),
    }));
    return { title: makeTitle(lines[0]), topics };
  }

  // Single-subject mode: build a genuine fundamentals-to-advanced scaffold.
  const subject = cleaned.split("\n")[0]?.trim() || "your new subject";
  const s = subject.slice(0, 60);
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  const topics: ParsedTopic[] = [
    { title: `Orientation: what ${s} is and why it matters`, hours: 1.5 },
    { title: `${cap} fundamentals — core vocabulary and first principles`, hours: 2.5 },
    { title: `Guided practice: worked examples, step by step`, hours: 2.5 },
    { title: `Core techniques you will reach for every time`, hours: 3 },
    { title: `Common mistakes and how to untangle them`, hours: 2 },
    { title: `Applied mini-project: put ${s} to work on something real`, hours: 3.5 },
    { title: `Advanced patterns and where to go next`, hours: 2.5 },
  ].map((t, i, arr) => ({
    title: t.title,
    hours: t.hours,
    level: levelFor(t.title, i / (arr.length - 1)),
  }));
  return { title: cap, topics };
}

function makeTitle(firstLine: string): string {
  const t = firstLine.replace(/^(syllabus|course outline|course)[:\s-]*/i, "").trim();
  return (t.length > 60 ? `${t.slice(0, 57)}…` : t) || "Untitled plan";
}
