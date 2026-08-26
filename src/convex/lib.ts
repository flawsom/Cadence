// Shared server-side helpers for the Cadence engine.
// Pure TypeScript — safe to import from any Convex function.

export type ParsedTopic = {
  title: string;
  hours: number;
  level: number;
  practice?: string[];
  challenge?: string;
};

/**
 * System prompt for AI-assisted ingestion. Works with any OpenAI-compatible
 * endpoint — including a fully local Ollama / llama.cpp / LM Studio server.
 */
export const SYLLABUS_SYSTEM_PROMPT =
  "You are Cadence's curriculum planner. From the user's syllabus text or a simple topic name (like \"python\" or \"machine learning\"), produce a JSON object: " +
  '{"title": string (short plan name), "topics": [{"title": string, "hours": number, "level": number, "practice": string[], "challenge": string}]}.\n\n' +
  "RULES:\n" +
  "1. If the user gives ONLY a topic/language name (no syllabus), assume they know NOTHING. Start from absolute basics: what it is, core vocabulary, syntax, first principles. Build through intermediate to advanced mastery.\n" +
  "2. Order topics fundamentals-first, never document order.\n" +
  "3. hours = focused study time per topic, between 0.5 and 6, realistic for a diligent human.\n" +
  "4. level = 1 (foundations), 2 (core), or 3 (advanced/mastery).\n" +
  "5. Produce between 8 and 30 topics for bare-topic inputs, 5–24 for full syllabi.\n" +
  "6. practice = 2–4 concrete practice problems the learner should solve AFTER studying this topic. Be specific: write actual problem statements, not vague descriptions. Example: \"Write a function that finds the longest common subsequence of two strings\".\n" +
  "7. challenge = ONE hard, non-trivial problem that tests deep mastery of this topic. It should be solvable but require real thought. Example: \"Implement a red-black tree with insert, delete, and rebalance operations from scratch\".\n" +
  "8. For mathematical notation use LaTeX in $ signs: $\\delta(t)$, $2\\pi$, $\\nabla^2 u = 0$.\n" +
  "9. For language/framework topics, include practice with increasing difficulty: simple scripts → data structures → algorithms → real-world projects.\n" +
  "10. Return ONLY valid JSON, no commentary.";

/** Normalizes raw model output into safe, bounded ParsedTopics. */
export function normalizeTopics(input: unknown): ParsedTopic[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const t = raw as Record<string, unknown>;
      const title = String(t?.title ?? "").trim().slice(0, 120);
      const hours = Math.min(8, Math.max(0.5, Math.round(Number(t?.hours ?? 2) * 4) / 4));
      const level = Math.min(3, Math.max(1, Math.round(Number(t?.level ?? 2))));
      // Practice problems: array of specific problem statements.
      const practice = Array.isArray(t?.practice)
        ? (t.practice as unknown[])
            .map((p) => String(p ?? "").trim().slice(0, 200))
            .filter((p) => p.length >= 5)
            .slice(0, 5)
        : [];
      // Challenge problem: one hard mastery-level problem.
      const challenge = String(t?.challenge ?? "").trim().slice(0, 300);
      return { title, hours, level, practice, challenge };
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
  /^(learning\s+outcomes?|course\s+outcomes?|text\s*books?|references?|recommended\s+reading|grading|assessment\s+scheme)\b/i;

/** Structural noise even before a stop marker. */
const NOISE_LINE_RE =
  /^co\d+\b|^\d+[.)]\s|https?:\/\/|\d+\s+quizzes?\b|peer-review|^sub-?topics?\s*$|isbn|^formative\s+assessments?\s*:?$|^assessments?\s*:$/i;

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
  // Long lines are NOT automatically prose: university modules pack dozens of
  // comma-separated sub-topics into one 700+ character line. Only narrative
  // keywords, sentence-dense text, or a LONG line without list structure is
  // discarded.
  const listy = line.split(",").length >= 6;
  return terminators >= 5 || (line.length > 500 && !listy);
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
    // Canonicalize typographic/math variants for consistent rendering.
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2212/g, "-")
    .replace(/\u{1D70B}/gu, "π")
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
    // Salvage pass: a sentence whose ALL-OR-NOTHING list check failed may
    // still contain mostly-clean fragments ("…lines (method of least
    // squares), correlation coefficient with basic properties."). Split on
    // commas and keep fragments that individually look like real topics;
    // require each to be substantial (≥3 words) so "part 2" debris can't
    // sneak through on a single-comma split.
    if (pieces.length === 1 && s.includes(",")) {
      const salvaged = s
        .split(",")
        .map((frag) => frag.trim())
        .filter((frag) => {
          const fw = frag.split(/\s+/).length;
          return (
            frag.length >= 3 && fw >= 3 && fw <= 9 && !DEBRIS_LEAD_RE.test(frag)
          );
        });
      if (salvaged.length >= 2) pieces = salvaged;
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
          .map((w) => {
            if (/\d/.test(w)) return w;
            // Hyphenated tokens capitalize per segment; Roman numerals
            // stay capital: Mathematics-III, Module-IV, Part-VI.
            return w
              .split("-")
              .map((seg) =>
                /^[ivxlc]+$/i.test(seg)
                  ? seg.toUpperCase()
                  : seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase(),
              )
              .join("-");
          })
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

  // Dedupe (case-insensitive); drop fragments that merely PREFIX a longer
  // sibling ("Operators" before "Operators and type casting"). Substring
  // matching is NOT enough: "correlation coefficient with basic properties"
  // legitimately coexists with an earlier "Basic properties".
  const seen = new Set<string>();
  const collected: { title: string; hours: number | null }[] = [];
  for (const item of flat) {
    const k = item.title.toLowerCase();
    if (seen.has(k) || k === title.toLowerCase()) continue;
    const contained = collected.some((c) => {
      const ck = c.title.toLowerCase();
      return ck.startsWith(k) || k.startsWith(ck);
    });
    if (contained) continue;
    seen.add(k);
    collected.push(item);
  }
  const unique = collected;

  if (unique.length < 3) {
    // Single-subject mode: build a genuine fundamentals-to-advanced scaffold
    // with specific practice problems and a capstone challenge per topic.
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
    const lower = s.toLowerCase();
    const scaffold: ParsedTopic[] = [
      {
        title: `What is ${s}? — core concepts and vocabulary`,
        hours: 1.5,
        practice: [
          `List 10 key terms in ${s} and write a one-sentence definition for each`,
          `Explain ${s} to someone who has never heard of it in 3 paragraphs`,
          `Draw a concept map connecting the 5 most important ideas in ${s}`,
        ],
        challenge: `Write a comprehensive FAQ document covering the 15 most common questions beginners ask about ${s}`,
      },
      {
        title: `${cap} fundamentals — syntax, building blocks, first principles`,
        hours: 2.5,
        practice: [
          `Set up a working ${s} environment from scratch and run a hello-world program`,
          `Write 5 small programs/scripts that demonstrate the core building blocks of ${s}`,
          `Reproduce 3 example programs from a beginner ${s} tutorial without looking at the solution`,
        ],
        challenge: `Build a complete, working mini-project from scratch that uses all the fundamental concepts of ${s} — no copy-pasting from tutorials`,
      },
      {
        title: `Core data structures and algorithms in ${s}`,
        hours: 3,
        practice: [
          `Implement arrays/lists, linked lists, stacks, and queues from scratch in ${s}`,
          `Write search and sort algorithms and benchmark their performance`,
          `Solve 5 LeetCode-style easy problems using the data structures you implemented`,
        ],
        challenge: `Design and implement a custom data structure (hash map or tree) with O(1) average-case operations, including collision handling and resizing`,
      },
      {
        title: `Control flow, functions, and error handling mastery`,
        hours: 2.5,
        practice: [
          `Write a program that uses loops, conditionals, and recursion to solve a real problem`,
          `Refactor a long function into smaller, well-named functions with clear responsibilities`,
          `Add proper error handling to a program that currently crashes on bad input`,
        ],
        challenge: `Build a recursive solver for a non-trivial problem (e.g., maze solver, expression evaluator, or backtracking puzzle) with proper error handling`,
      },
      {
        title: `Intermediate patterns — OOP, modules, and code organization`,
        hours: 3,
        practice: [
          `Design a class hierarchy for a real-world system (library, inventory, or game)`,
          `Split a monolithic script into well-organized modules with clear interfaces`,
          `Write unit tests for your modules and achieve at least 80% code coverage`,
        ],
        challenge: `Architect a multi-module application with proper separation of concerns: data layer, business logic, and interface — all with comprehensive tests`,
      },
      {
        title: `Working with external libraries and APIs`,
        hours: 2.5,
        practice: [
          `Install and use 3 popular ${s} libraries to solve different problems`,
          `Fetch data from a public REST API and process/display the results`,
          `Write a script that reads/writes files and processes real-world data (CSV, JSON, or XML)`,
        ],
        challenge: `Build a CLI tool or web scraper that fetches, parses, transforms, and stores data from multiple API sources with rate limiting and error recovery`,
      },
      {
        title: `Advanced ${s} — performance, patterns, and best practices`,
        hours: 3,
        practice: [
          `Profile a slow program, identify the bottleneck, and optimize it by at least 10x`,
          `Implement a design pattern (observer, factory, or strategy) to solve a real problem`,
          `Review and refactor existing code for readability, performance, and maintainability`,
        ],
        challenge: `Build a production-quality ${s} project that demonstrates advanced patterns: caching, lazy loading, concurrency, or plugin architecture — with documentation and benchmarks`,
      },
      {
        title: `Applied capstone — real-world project from scratch`,
        hours: 4,
        practice: [
          `Plan the architecture for a real-world ${s} project: database, API, and frontend`,
          `Implement the core features with proper error handling, logging, and tests`,
          `Deploy or package your project so others can use it`,
        ],
        challenge: `Design, implement, test, and document a complete ${s} application that solves a real problem you care about — something you could show in a portfolio or put on a resume`,
      },
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

  // Ultra-granular syllabi (some list 100+ sub-points) become task spam.
  // Merge the most trivial adjacent pairs until the plan is human-sized;
  // content is preserved — two small steps become one slightly bigger one.
  const MAX_TOPICS = 30;
  const merged = [...topics];
  while (merged.length > MAX_TOPICS) {
    let best = 0;
    let bestCost = Infinity;
    for (let i = 0; i < merged.length - 1; i++) {
      const cost =
        merged[i].title.length +
        merged[i + 1].title.length +
        Math.abs(merged[i].hours - merged[i + 1].hours) * 10 +
        Math.abs(merged[i].level - merged[i + 1].level) * 20;
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    const a = merged[best];
    const b = merged[best + 1];
    merged.splice(best, 2, {
      title: `${a.title} & ${b.title}`.slice(0, 120),
      hours: roundQuarter(a.hours + b.hours),
      level: Math.min(a.level, b.level),
    });
  }
  return { title, topics: merged };

  // Title priority: course-code/header line > first clean topic > raw first line.
  if (!title) {
    const base = titleSource || unique[0]?.title || lines[0] || "Untitled plan";
    title = makeTitle(base);
  }
  return { title, topics };
}
