// Shared server-side helpers for the Cadence engine.
// Pure TypeScript — safe to import from any Convex function.

export type ParsedTopic = { title: string; hours: number; level: number };

/**
 * System prompt for AI-assisted ingestion. Works with any OpenAI-compatible
 * endpoint — including a fully local Ollama / llama.cpp / LM Studio server.
 */
export const SYLLABUS_SYSTEM_PROMPT =
  "You are Cadence's curriculum planner. From the user's syllabus text or subject description, produce a JSON object: " +
  '{"title": string (short plan name), "topics": [{"title": string, "hours": number, "level": number}]}. ' +
  "Order topics fundamentals-first and build toward advanced material (never document order for its own sake). " +
  "hours is focused study time per topic, between 0.5 and 6, realistic for a diligent human. " +
  "level is 1 (foundations), 2 (core), or 3 (advanced). Produce between 5 and 24 topics. Return only JSON.";

/** Normalizes raw model output into safe, bounded ParsedTopics. */
export function normalizeTopics(input: unknown): ParsedTopic[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const t = raw as Record<string, unknown>;
      const title = String(t?.title ?? "").trim().slice(0, 120);
      const hours = Math.min(8, Math.max(0.5, Math.round(Number(t?.hours ?? 2) * 4) / 4));
      const level = Math.min(3, Math.max(1, Math.round(Number(t?.level ?? 2))));
      return { title, hours, level };
    })
    .filter((t) => t.title.length > 1)
    .slice(0, 40);
}

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

// ---------------------------------------------------------------------------
// Syllabus ingestion — deterministic engine (the always-works fallback)
//
// Built against real university formats: module headers with hour budgets
// ("Module 1: … [24 Hours]", "MODULE - I: (08 Hrs)"), chapter headings,
// comma/semicolon-packed sub-topic lists, narrative descriptions, learning
// outcomes, and textbook/reference trailers.
// ---------------------------------------------------------------------------

const LEVEL_WORDS: [RegExp, number][] = [
  [/\b(intro|introduction|basic|basics|fundamental|fundamentals|foundation|principle|getting started|overview|orientation|elements?)\b/i, 1],
  [/\b(intermediate|applied|practice|practicum|technique|techniques|workshop|lab|core|method|methods|tooling|enhancement|manipulation)\b/i, 2],
  [/\b(advanced|expert|deep|mastery|capstone|specialized|optimi[sz]ation|architecture|research|seminar|compression|multithreading|distributed|security)\b/i, 3],
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

const roundQuarter = (n: number) => Math.round(n * 4) / 4;

/** Everything after one of these markers is course meta, never studyable content. */
const SECTION_STOP_RE =
  /^(learning\s+outcomes?|course\s+outcomes?|text\s*books?|references?|recommended\s+reading|grading|assessment\s+scheme|formative\s+assessments?)\b/i;

/** Structural noise even before a stop marker. */
const NOISE_LINE_RE =
  /^co\d+\b|^\d+[.)]\s|https?:\/\/|\d+\s+quizzes?\b|peer-review|^sub-?topics?\s*$|isbn/i;

/** Course-code title like "PCAR2004 CLOUD COMPUTING FOUNDATIONS (3-0-0)". */
const COURSE_CODE_RE = /^[A-Z]{2,4}\d{3,4}\s+\S/;

/** "[24 Hours]" / "(10 Hrs)" — module time budgets we honor when scheduling. */
const HOURS_TAG_RE = /[[(]\s*(\d{1,3})\s*(?:hours?|hrs?)\s*[\])]/i;

/** "Module I:", "Chapter 2 :", "Unit 3", "Part IV -" … structural buckets. */
const MODULE_RE =
  /^(module|unit|chapter|part|section)\s*[-–—:.]?\s*(?:[ivxlc]+|\d+)\b\s*[:.)\-–—]?\s*/i;

/** Document-y headers that name the plan rather than list a topic. */
const HEADER_RE =
  /^(syllabus|course outline|course plan|blueprint)\b|^exam\b[^:\n]*\bblueprint\b|^[A-Z]{2,4}\d{3,4}\b/i;

/** Narrative sentences describing the course are never topics. */
const PROSE_RE =
  /\b(this course|the objective|learners?|students?|shall be able|will be able to|interviews with|learn about|get your hands dirty|much,? much more|prerequisites? before|self-paced)\b/i;

/** Fragments beginning with these are clause debris, not subject matter. */
const DEBRIS_LEAD_RE =
  /^(whether|and|or|but|with|like|including|thus|also|in|on|at|for|the|this|it|its|their|they|some|know|get|prior|such|appropriate)\b/i;

function isProse(line: string): boolean {
  if (PROSE_RE.test(line)) return true;
  const terminators = (line.match(/[.!?]/g) ?? []).length;
  return terminators >= 4 || line.length > 260;
}

function stripHoursTag(line: string): { text: string; hours: number | null } {
  const m = HOURS_TAG_RE.exec(line);
  if (!m) return { text: line.replace(/\s{2,}/g, " ").trim(), hours: null };
  return {
    text: line.replace(HOURS_TAG_RE, "").replace(/[\s()[\]:.-]+$/, "").trim(),
    hours: Number(m[1]),
  };
}

function basicClean(line: string): string {
  return line
    .replace(/^[\s•·▪◦‣⁃\u2013\u2014*-]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One source line often holds N topics: "Hashing, Sorting, Shortest paths"
 * or semicolon lists, or packed sentences. Returns clean topic candidates.
 */
function extractTopicsFromLine(line: string): string[] {
  const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g);
  const out: string[] = [];
  for (const rawSentence of sentences) {
    let s = rawSentence.trim();
    if (!s) continue;
    // Drop a leading label: "IMAGE ENHANCEMENT: Spatial Domain: Some…"
    const labeled = /^([^:{[(]{3,48}):\s*(.+)$/.exec(s);
    if (labeled && labeled[2].split(/\s+/).length >= 3) s = labeled[2];
    // Split on semicolons freely; on commas only when it clearly is a list.
    let pieces: string[];
    if (s.includes(";")) {
      const parts = s
        .split(";")
        .map((p) => p.trim())
        .filter((p) => p.split(/\s+/).length >= 2);
      pieces = parts.length >= 2 ? parts : [s];
    } else if (s.split(",").length >= 3) {
      const parts = s.split(",").map((p) => p.trim());
      pieces =
        parts.every((p) => p.split(/\s+/).length <= 9 && p.length >= 3)
          ? parts
          : [s];
    } else {
      pieces = [s];
    }
    for (const piece of pieces) {
      let p = piece.replace(/[.\s]+$/, "").trim();
      // Objective verbs ("To study …") reduce to their subject matter.
      p = p.replace(
        /^to\s+(?:study|understand|apply|learn|analyse|analyze|grasp)\s+(?:the\s+|how\s+to\s+)?/i,
        "",
      ).trim();
      // A leftover inner label ("Introduction: Origin") yields its content.
      const inner = /^([^:{[(]{3,40}):\s*(.{3,})$/.exec(p);
      if (inner) p = inner[2].trim();
      if (p.length < 3 || p.length > 70) continue;
      const wc = p.split(/\s+/).length;
      // Real sub-topics are compact noun phrases.
      if (wc > 8 || (wc === 1 && p.length < 6)) continue;
      if (/^(what|why|how|when|who|where)\b.*\?$/i.test(p)) continue;
      if (DEBRIS_LEAD_RE.test(p)) continue;
      // Normalize a lowercase list continuation into display form.
      out.push(p.charAt(0).toUpperCase() + p.slice(1));
    }
  }
  return out;
}

function makeTitle(firstLine: string): string {
  // Strip document-y prefixes but KEEP the exam/subject name that follows.
  const stripped = firstLine
    .replace(COURSE_CODE_RE, (m) =>
      m.replace(/\s*[[(]?\d\s*-\s*\d\s*-\s*\d[\])]?\s*$/i, ""),
    )
    .replace(/^(syllabus|course outline|course plan|course)[:\s-]*/i, "")
    .replace(/^[\s\u2014\u2013\-:·]+/, "")
    .replace(/[\s:\u2014\u2013-]+$/, "")
    .trim();
  const t =
    (stripped || firstLine.replace(/[\s:]+$/, "").trim())
      .replace(/\s*[[(]?\d\s*-\s*\d\s*-\s*\d[\])]?\s*$/i, "")
      .trim();
  // ALL-CAPS course names read better in title case (digits stay untouched).
  const titled =
    t.length > 8 && t === t.toUpperCase() && /[A-Z]{3}/.test(t)
      ? t
          .split(/\s+/)
          .map((w) =>
            /\d/.test(w)
              ? w
              : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
          )
          .join(" ")
      : t;
  return (titled.length > 60 ? `${titled.slice(0, 57)}…` : titled) || "Untitled plan";
}

/** Deterministic fallback parser: real sequencing, no AI required. */
export function heuristicParse(raw: string): {
  title: string;
  topics: ParsedTopic[];
} {
  const cleaned = raw.replace(/\r/g, "").trim();
  const lines = cleaned.split("\n").map(basicClean).filter(Boolean);

  let title = "";
  let titleSource = "";
  type Bucket = { hours: number | null; titles: string[] };
  let current: Bucket = { hours: null, titles: [] };
  const buckets: Bucket[] = [current];

  for (const line of lines) {
    if (SECTION_STOP_RE.test(line)) break;
    if (NOISE_LINE_RE.test(line)) continue;

    // Course-code line names the plan and is not itself a topic.
    if (!title && COURSE_CODE_RE.test(line)) {
      title = makeTitle(line);
      titleSource = line;
      continue;
    }

    const { text, hours } = stripHoursTag(line);

    // Module/chapter headers start a new hour-budgeted bucket.
    const mod = MODULE_RE.exec(text);
    if (mod) {
      current = { hours, titles: [] };
      buckets.push(current);
      const remainder = text.slice(mod[0].length).trim();
      if (remainder.length >= 3) {
        current.titles.push(...extractTopicsFromLine(remainder));
      }
      continue;
    }

    if (HEADER_RE.test(text) && !title) {
      title = makeTitle(text);
      titleSource = text;
      continue;
    }

    // Bare labels like "Course Objectives:" are structure, not content.
    if (/^[\w\s&/-]{2,32}:$/.test(text)) {
      if (!titleSource && /objective/i.test(text)) titleSource = text.replace(/:$/, "");
      continue;
    }

    // Course-narrative lines never yield topics — check before extracting.
    if (isProse(text)) {
      if (!titleSource) titleSource = text;
      continue;
    }

    const topicsFromLine = extractTopicsFromLine(text);
    if (topicsFromLine.length > 0) {
      current.titles.push(...topicsFromLine);
      continue;
    }

    // Nothing extracted: keep genuinely short standalone lines as topics,
    // with objective verbs ("To study …") stripped down to the subject.
    const single = text
      .replace(/[.\s]+$/, "")
      .replace(
        /^to\s+(?:study|understand|apply|learn|analyse|analyze|grasp)\s+(?:the\s+|how\s+to\s+)?/i,
        "",
      );
    const wc = single.split(/\s+/).length;
    if (wc <= 9 && single.length >= 3 && single.length <= 60) {
      current.titles.push(single);
    } else if (!titleSource && wc >= 2) {
      titleSource = single;
    }
  }

  // Flatten buckets, honoring module hour budgets when present.
  const flat: { title: string; hours: number | null }[] = [];
  for (const b of buckets) {
    const n = b.titles.length;
    if (n === 0) continue;
    const per = b.hours != null ? roundQuarter(Math.max(0.5, b.hours / n)) : null;
    for (const t of b.titles) {
      flat.push({ title: t, hours: per });
    }
  }

  // Dedupe (case-insensitive) and drop fragments already contained in a
  // longer sibling ("Operators" inside "Different types of operators").
  const seen = new Set<string>();
  const collected: { title: string; hours: number | null }[] = [];
  for (const item of flat) {
    const k = item.title.toLowerCase();
    if (seen.has(k) || k === title.toLowerCase()) continue;
    const contained = collected.some(
      (c) =>
        c.title.toLowerCase().includes(k) || k.includes(c.title.toLowerCase()),
    );
    if (contained) continue;
    seen.add(k);
    collected.push(item);
  }
  const unique = collected;

  if (unique.length < 3) {
    // Single-subject mode: build a genuine fundamentals-to-advanced scaffold.
    const subject =
      cleaned
        .split("\n")[0]
        ?.trim()
        .replace(
          /^(?:i\s+(?:want|would\s+like)\s+to\s+|let'?s\s+)?(?:learn|study|master|understand|get\s+good\s+at)\s+(?:how\s+to\s+)?/i,
          "",
        )
        .replace(/[.!?\s]+$/, "") ||
      title ||
      "your new subject";
    const s = subject.slice(0, 60);
    const cap = s.charAt(0).toUpperCase() + s.slice(1);
    const scaffold: ParsedTopic[] = [
      { title: `Orientation: what ${s} is and why it matters`, hours: 1.5 },
      { title: `${cap} fundamentals — core vocabulary and first principles`, hours: 2.5 },
      { title: `Guided practice: worked examples, step by step`, hours: 2.5 },
      { title: `Core techniques you will reach for every time`, hours: 3 },
      { title: `Common mistakes and how to untangle them`, hours: 2 },
      { title: `Applied mini-project: put ${s} to work on something real`, hours: 3.5 },
      { title: `Advanced patterns and where to go next`, hours: 2.5 },
    ].map((t, i, arr) => ({
      ...t,
      level: levelFor(t.title, i / (arr.length - 1)),
    }));
    return { title: cap, topics: scaffold };
  }

  const total = unique.length;
  const topics: ParsedTopic[] = unique.map(({ title: t, hours }, i) => ({
    title: t.slice(0, 120),
    hours: hours ?? hoursFor(t),
    level: levelFor(t, total > 1 ? i / (total - 1) : 0),
  }));

  // Title priority: course-code/header line > first clean topic > raw first line.
  if (!title) {
    const base = titleSource || unique[0]?.title || lines[0] || "Untitled plan";
    title = makeTitle(base);
  }
  return { title, topics };
}
