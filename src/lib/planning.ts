/**
 * Cadence planning engine — pure TypeScript, no I/O.
 *
 * Everything here is deterministic so schedules stay explainable:
 *  - parseSyllabus: free text → ordered topics (fundamentals float up)
 *  - buildSchedule: topics → day-by-day chunks that never exceed a day's budget
 *  - findFitDate:   where a rolled-forward task or review lands next
 */

// ---------------------------------------------------------------------------
// Dates (all dates are plain "yyyy-mm-dd" strings, client-local)
// ---------------------------------------------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    (parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000,
  );
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function prettyDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function longDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (Number.isInteger(h)) return `${h}h`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins === 0 ? `${whole}h` : `${whole}h ${mins}m`;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

// ---------------------------------------------------------------------------
// Syllabus parsing
// ---------------------------------------------------------------------------

const MARKER_RE =
  /^\s*(?:(?:\d{1,2}|[a-zA-Z])\s*[.):\-–]\s*|(?:week|module|unit|chapter|lesson|part|topic)\s*\d+\s*[:.\-–]\s*|[-•*·▪◦‣⁃]\s+)/i;

const BASIC_HINTS = [
  "introduction",
  "intro",
  "basic",
  "basics",
  "fundamental",
  "fundamentals",
  "getting started",
  "setup",
  "install",
  "prerequisite",
  "overview",
  "syntax",
  "foundations",
  "primer",
  "hello world",
];

const ADVANCED_HINTS = [
  "advanced",
  "optimization",
  "optimising",
  "optimizing",
  "internals",
  "distributed",
  "concurrency",
  "parallel",
  "production",
  "capstone",
  "deployment",
  "devops",
  "security",
  "performance",
  "architecture",
  "master",
  "expert",
  "deep dive",
  "research",
  "project",
];

function countHints(title: string, hints: string[]): number {
  const t = title.toLowerCase();
  return hints.reduce((acc, h) => acc + (t.includes(h) ? 1 : 0), 0);
}

function estimateHours(title: string): number {
  const words = title.split(/\s+/).length;
  let h = 2 + Math.min(2, words / 12);
  h += countHints(title, ADVANCED_HINTS) * 0.75;
  h -= countHints(title, BASIC_HINTS) * 0.5;
  return roundQuarter(Math.min(5, Math.max(0.75, h)));
}

/** Lower score sorts earlier. Fundamentals float up; advanced sinks down. */
function sequenceScore(title: string): number {
  return countHints(title, BASIC_HINTS) - countHints(title, ADVANCED_HINTS);
}

function cleanTitle(raw: string): string {
  let t = raw.replace(MARKER_RE, "").trim();
  t = t.replace(/[:：]\s*$/, "").replace(/\s+/g, " ");
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]{3}/.test(t)) {
    t =
      t.charAt(0).toUpperCase() +
      t.slice(1).toLowerCase();
  }
  if (t.length > 90) t = `${t.slice(0, 87).trimEnd()}…`;
  return t;
}

export interface ParsedTopic {
  title: string;
  estimatedHours: number;
}

/**
 * Turns pasted syllabus text into an ordered topic list.
 * Falls back to treating the whole input as one subject when there is no
 * discernible structure — Cadence never invents topics that weren't there.
 */
export function parseSyllabus(text: string): {
  topics: ParsedTopic[];
  mode: "structured" | "lines" | "subject";
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const marked = lines.filter((l) => MARKER_RE.test(l));

  let candidates: string[] = [];
  let mode: "structured" | "lines" | "subject" = "subject";

  if (marked.length >= 3) {
    candidates = marked.map(cleanTitle);
    mode = "structured";
  } else {
    const substantial = lines.filter(
      (l) => !MARKER_RE.test(l) && l.split(/\s+/).length >= 2 && l.length <= 120,
    );
    if (substantial.length >= 3) {
      candidates = substantial.map(cleanTitle);
      mode = "lines";
    } else if (substantial.length >= 1) {
      candidates = [cleanTitle(substantial[0])];
      mode = "subject";
    }
  }

  candidates = candidates.filter((c) => c.length >= 3);

  // Stable sort so basics float up without scrambling sensible orders.
  const scored = candidates.map((title, i) => ({
    title,
    estimatedHours: estimateHours(title),
    i,
    score: sequenceScore(title),
  }));
  scored.sort((a, b) => a.score - b.score || a.i - b.i);

  return {
    topics: scored.map(({ title, estimatedHours }) => ({
      title,
      estimatedHours,
    })),
    mode,
  };
}

/** Phase by position once ordered fundamentals-first. */
export function phaseFor(position: number, total: number): "foundations" | "core" | "advanced" {
  if (total <= 2) return position === 0 ? "foundations" : "advanced";
  const third = total / 3;
  if (position < third) return "foundations";
  if (position < third * 2) return "core";
  return "advanced";
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface ScheduleChunk {
  date: string;
  label: string;
  hours: number;
  part?: number;
  totalParts?: number;
}

interface PlannableTopic {
  title: string;
  hours: number;
}

function splitTopic(topic: PlannableTopic): { hours: number; count: number } {
  // Aim for study blocks of ~2h max — attention is a real constraint.
  const count = Math.max(1, Math.ceil(topic.hours / 2));
  return { hours: roundQuarter(topic.hours / count), count };
}

/**
 * Greedily lays topic chunks onto calendar days.
 * `budget` maps yyyy-mm-dd → remaining hours that day; it is mutated as we
 * place chunks so callers can seed it with existing plans' load first.
 * Never places more than a day's remaining budget — if a chunk doesn't fit
 * it moves to the next day, even past the requested end date.
 */
export function buildSchedule(
  orderedTopics: PlannableTopic[],
  startDate: string,
  budget: Map<string, number>,
  labelFor?: (topic: PlannableTopic) => string,
): { tasks: ScheduleChunk[]; endDate: string } {
  const tasks: ScheduleChunk[] = [];
  let cursor = startDate;
  let guard = 0;

  for (const topic of orderedTopics) {
    const { hours: partHours, count } = splitTopic(topic);
    for (let p = 1; p <= count; p++) {
      let placed = false;
      while (!placed) {
        if (guard++ > 2000) return { tasks, endDate: cursor };
        const remaining = budget.get(cursor) ?? 0;
        if (remaining >= partHours - 0.001 && remaining > 0) {
          budget.set(cursor, roundQuarter(remaining - partHours));
          tasks.push({
            date: cursor,
            label:
              labelFor?.(topic) ??
              (count > 1 ? `${topic.title} · part ${p} of ${count}` : topic.title),
            hours: partHours,
            ...(count > 1 ? { part: p, totalParts: count } : {}),
          });
          placed = true;
        } else {
          cursor = addDays(cursor, 1);
        }
      }
    }
  }

  return { tasks, endDate: cursor };
}

/**
 * First date on/after `fromDate` where `hours` fits within the day's budget.
 * Used for rolled-forward work and spaced-repetition reviews.
 */
export function findFitDate(
  budget: Map<string, number>,
  fromDate: string,
  hours: number,
): string {
  let cursor = fromDate;
  for (let i = 0; i < 400; i++) {
    const remaining = budget.get(cursor) ?? 0;
    if (remaining >= hours - 0.001) return cursor;
    cursor = addDays(cursor, 1);
  }
  return fromDate;
}

/** Rebuilds a per-date remaining-hours map from stored tasks. */
export function seedBudget(
  dailyBudget: number,
  existing: { date: string; hours: number; completed: boolean }[],
  fromDate: string,
  daysAhead = 120,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < daysAhead; i++) {
    map.set(addDays(fromDate, i), dailyBudget);
  }
  for (const t of existing) {
    if (t.completed) continue;
    const cur = map.get(t.date);
    if (cur !== undefined) map.set(t.date, Math.max(0, roundQuarter(cur - t.hours)));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Spaced repetition schedule
// ---------------------------------------------------------------------------

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 16, 35] as const;
export const REVIEW_HOURS = 0.5;

export function reviewLabel(topicTitle: string, stage: number): string {
  const stageNames = ["first look back", "quick recall", "solidifying", "long-term check", "final pass"];
  return `${topicTitle} — ${stageNames[Math.min(stage - 1, stageNames.length - 1)]}`;
}
