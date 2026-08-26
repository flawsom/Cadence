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

/**
 * Subject domain classifier — detects whether a bare topic name is programming,
 * a human language, music, science, math, creative arts, or humanities, so the
 * heuristic scaffold can generate genuinely relevant practice problems.
 */
type Domain = "programming" | "language" | "music" | "science" | "math" | "creative" | "humanities" | "general";

function classifySubject(s: string): Domain {
  const l = s.toLowerCase();
  if (/\b(python|rust|java|javascript|typescript|c\+\+|c#|go|ruby|php|swift|kotlin|r\b|matlab|sql|html|css|react|vue|angular|node|django|flask|spring|rails|programming|coding|software|full.?stack|backend|frontend|devops|git|docker|kubernetes|linux|shell|bash|powershell|regex|api|database|mongodb|postgres|redis|ai|artificial\s*intell|neural|cyber.?sec|penetration|ethical\s*hack|cloud|aws|azure|gcp|terraform|ansible|machine\s*learning|deep\s*learning|data\s*science|web\s*development|web\s*dev)\b/.test(l)) return "programming";
  if (/\b(japanese|spanish|french|german|chinese|mandarin|korean|arabic|hindi|portuguese|italian|russian|latin|greek|english|hebrew|thai|vietnamese|turkish|dutch|swedish|polish|swahili|urdu|bengali|punjabi|tamil|telugu|marathi|gujarati|kannada|malayalam|sign\s*lang|esperanto|linguistics|grammar|vocabulary|conversation|fluency|bilingual|translation)\b/.test(l)) return "language";
  if (/\b(piano|guitar|violin|drums|bass|saxophone|flute|trumpet|cello|ukulele|music|singing|vocal|harmony|rhythm|melody|chord|scale|theory|composition|songwriting|dj|producer|beat.?mak|audio|sound\s*design|mix|master)\b/.test(l)) return "music";
  if (/\b(chemistry|physics|biology|organic|biochem|genetics|anatomy|physiology|ecology|zoology|botany|geology|astronomy|astro|meteorology|environmental|neuro|psych|cognitive|pharmacology|microbiol|immunology|epidemiol|medicine|nursing|anatomy|pathology|genetics|molecular|cell|bio)\b/.test(l)) return "science";
  if (/\b(algebra|geometry|calculus|trigonometry|statistics|probability|linear\s*algebra|discrete|number\s*theory|combinatorics|graph\s*theory|topology|differential|equation|matrix|vector|math|mathematics|arithmetic|precalc|analy)\b/.test(l)) return "math";
  if (/\b(photography|drawing|painting|sketch|illustration|design|graphic|ux|ui|animation|3d|blender|photoshop|figma|logo|typography|color\s*theory|visual|art|craft|woodwork|pottery|ceramic|knit|sew|cook|baking|culinary|chefs|recipe|food|wine|cocktail|barista|gardening|landscape|interior|fashion)\b/.test(l)) return "creative";
  if (/\b(philosophy|history|economics|psych|sociology|anthropology|political|international\s*rel|law|ethics|religion|theology|literature|writing|creative\s*writing|poetry|essay|journalism|media|communi|linguistics|archaeology|geography|cultural|gender|post.?colon|critical\s*theory|humanities)\b/.test(l)) return "humanities";
  return "general";
}

/** Domain-specific scaffold: generates genuinely relevant topics, practice problems, and challenges. */
function buildDomainScaffold(s: string, cap: string): ParsedTopic[] {
  const domain = classifySubject(s);
  type T = Omit<ParsedTopic, "level">;
  const templates: Record<Domain, T[]> = {
    programming: [
      { title: `What is ${s}? — purpose, ecosystem, and where it shines`, hours: 1.5, practice: [`List 10 key concepts or tools in ${s} and write a one-sentence explanation for each`, `Set up a working ${s} development environment from scratch and verify it works`, `Write a simple "hello world" program and explain what each line does`], challenge: `Research the ${s} ecosystem: list the top 5 frameworks/libraries, explain what each does, and write a comparison of their strengths and weaknesses` },
      { title: `${cap} fundamentals — syntax, types, and first programs`, hours: 2.5, practice: [`Write 5 small programs demonstrating variables, loops, conditionals, and functions in ${s}`, `Convert 3 beginner exercises from a ${s} tutorial into working code without copying`, `Debug 3 intentionally broken ${s} programs and explain what was wrong in each`], challenge: `Build a complete command-line tool in ${s} that takes user input, processes it, and produces formatted output — with proper error handling` },
      { title: `Data structures and algorithms in ${s}`, hours: 3, practice: [`Implement a linked list, stack, and queue from scratch in ${s}`, `Write a binary search function and test it against edge cases (empty, single element, duplicates)`, `Solve 3 classic algorithm problems (two sum, reverse string, palindrome check) and analyze their time complexity`], challenge: `Implement a hash table with collision handling (chaining or open addressing), automatic resizing, and benchmark it against the language's built-in map/dictionary` },
      { title: `Functions, modules, and code organization`, hours: 2.5, practice: [`Refactor a 100-line monolithic script into 5 well-named, single-responsibility functions`, `Create a reusable module/package with a clean public API and internal helpers`, `Write a function that accepts callbacks or higher-order functions to solve a real problem`], challenge: `Design and implement a plugin system: a core application that loads and executes external modules at runtime, with proper error isolation` },
      { title: `Object-oriented and structural patterns`, hours: 3, practice: [`Design a class hierarchy for a library management system (books, users, loans) with proper encapsulation`, `Implement the observer pattern for a file-watcher that notifies listeners on changes`, `Write unit tests achieving 80%+ coverage for a module you built`], challenge: `Build a small ORM (Object-Relational Mapper) that translates object methods into database queries, with schema validation and error handling` },
      { title: `Working with external data and APIs`, hours: 2.5, practice: [`Fetch data from a public REST API, parse the response, and display it in a formatted table`, `Build a script that reads a CSV file, transforms the data, and writes a summary report`, `Implement retry logic with exponential backoff for an unreliable network call`], challenge: `Build a web scraper that extracts structured data from 3 different websites, handles rate limiting, respects robots.txt, and stores results in a local database` },
      { title: `Advanced patterns, testing, and optimization`, hours: 3, practice: [`Profile a slow function, identify the bottleneck, and optimize it by 10x or more`, `Implement caching (memoization or LRU cache) for an expensive computation`, `Write integration tests that verify a complete user workflow end-to-end`], challenge: `Build a production-ready CLI tool with argument parsing, logging, configuration management, error recovery, and comprehensive test suite` },
      { title: `Capstone — build something real`, hours: 4, practice: [`Plan the architecture: data model, API design, component structure, and deployment strategy`, `Implement the core features with proper error handling, input validation, and logging`, `Write documentation: README, API docs, and setup instructions for a new contributor`], challenge: `Design, build, test, and deploy a complete application that solves a real problem — something you could show in a portfolio or put on your resume` },
    ],
    language: [
      { title: `The ${s} writing system — scripts, characters, and pronunciation`, hours: 2, practice: [`Write each character/letter 10 times, paying attention to stroke order and proportions`, `Transcribe 10 English words into ${s} script and check your accuracy`, `Record yourself reading 5 simple phrases and compare to native audio`], challenge: `Learn and demonstrate mastery of the entire writing system: write a paragraph from dictation covering all characters, common combinations, and exceptions` },
      { title: `Core grammar structures — word order and sentence building`, hours: 2.5, practice: [`Build 20 sentences using the basic word order pattern (e.g., SVO or SOV)`, `Conjugate 5 common verbs across present, past, and future tenses`, `Transform 5 affirmative sentences into negatives and then into questions`], challenge: `Write a 200-word paragraph about your daily routine using at least 8 different grammar structures, with correct word order and conjugation throughout` },
      { title: `Essential vocabulary — the most useful 200 words`, hours: 2.5, practice: [`Learn and write flashcards for the 50 most common ${s} words with translations`, `Group 100 vocabulary words into thematic clusters (family, food, travel, work)`, `Write 15 sentences using newly learned vocabulary in context`], challenge: `Create a thematic vocabulary atlas: 200 words organized into 10 categories with example sentences, cultural notes, and common collocations for each` },
      { title: `Listening and speaking — real conversation skills`, hours: 2.5, practice: [`Listen to 3 short ${s} audio clips and write down what you understand`, `Record yourself introducing yourself in ${s} (name, origin, hobbies, goals)`, `Practice a 5-minute dialog: ordering food at a restaurant`], challenge: `Record a 3-minute monologue about a topic of your choice entirely in ${s}, then transcribe it and self-correct pronunciation errors` },
      { title: `Reading comprehension — real texts`, hours: 2, practice: [`Read a short ${s} news article and summarize the main points in your native language`, `Translate a simple ${s} poem or song lyric, preserving the meaning`, `Read a children's story in ${s} and answer 5 comprehension questions`], challenge: `Read a full-length ${s} article or short story, write a critical analysis in ${s}, and identify 10 vocabulary words you didn't know` },
      { title: `Cultural context — idioms, etiquette, and daily life`, hours: 2, practice: [`List 10 common ${s} idioms or expressions and explain when each is used`, `Research dining etiquette in ${s}-speaking cultures and compare it to your own`, `Watch a ${s} TV show episode and identify 5 cultural references`], challenge: `Write a cultural guide for a tourist visiting a ${s}-speaking country: etiquette, common phrases, taboos, and how to navigate daily interactions` },
      { title: `Writing and composition in ${s}`, hours: 2.5, practice: [`Write a 150-word essay about your hometown in ${s}`, `Compose an email requesting information from a business, using polite/formal register`, `Rewrite a casual text message into formal ${s} appropriate for a business letter`], challenge: `Write a 300-word argumentative essay in ${s}$ on a topic you care about, with introduction, supporting paragraphs, and conclusion` },
      { title: `Putting it all together — immersive practice`, hours: 3, practice: [`Keep a daily journal entry in ${s}$ for 7 days (one paragraph each)`, `Have a 10-minute conversation with a language partner or tutor entirely in ${s}$`, `Translate a short article from your native language into ${s}$`], challenge: `Complete a full immersion project: write, record, and present a 5-minute presentation in ${s}$ about a topic that connects to your professional or personal goals` },
    ],
    music: [
      { title: `The ${s} — anatomy, tuning, and how sound works`, hours: 1.5, practice: [`Identify and label every part of the ${s} and explain its function`, `Tune the ${s}$ using an electronic tuner and verify each string/note`, `Play each open string/note and describe the pitch difference`], challenge: `Explain the physics of how the ${s}$ produces sound: vibration, resonance, and how body shape affects tone` },
      { title: `Basic technique — posture, hand position, and first notes`, hours: 2.5, practice: [`Practice proper posture and hand position for 15 minutes, checking form in a mirror`, `Play a 5-note scale (C major) slowly, focusing on even tone and rhythm`, `Learn and play 3 single-note melodies (e.g., "Twinkle Twinkle", "Ode to Joy")`], challenge: `Record yourself playing a simple melody. Critically evaluate: tone quality, rhythm accuracy, hand position, and areas for improvement` },
      { title: `Reading notation and rhythm fundamentals`, hours: 2.5, practice: [`Read and play 10 measures of simple sheet music without stopping`, `Clap and count a complex rhythm pattern (eighth notes, dotted notes, rests)`, `Transcribe a simple melody by ear into notation`], challenge: `Sight-read a piece at your level, then perform it with expression: dynamics, phrasing, and proper articulation` },
      { title: `Chords, harmony, and the fretboard/key geography`, hours: 3, practice: [`Learn and transition between 5 basic chords smoothly (one change per beat)`, `Map out the major scale across one octave in at least 2 positions/areas`, `Strum/play a 4-chord progression and identify each chord by ear`], challenge: `Build a chord chart for the 12 major triads across the entire fretboard/keyboard, and play each one from memory in sequence` },
      { title: `Scales, improvisation, and finding your voice`, hours: 2.5, practice: [`Play the major and minor pentatonic scales in 3 positions/octaves`, `Improvisate over a backing track for 2 minutes using only 5 notes`, `Transcribe a short solo or melody by ear and play it back`], challenge: `Compose and perform an original 8-bar solo over a backing track, using at least 3 different scale positions and dynamic contrast` },
      { title: `Songs, styles, and musical expression`, hours: 2.5, practice: [`Learn 2 complete songs from memory in your preferred style`, `Play along with a recording, matching tempo and feel`, `Analyze the structure of a song: intro, verse, chorus, bridge, and transitions`], challenge: `Arrange and perform a complete song for solo ${s}$: intro, verse, chorus, bridge, and outro — with dynamics and expression` },
      { title: `Practice strategies and overcoming plateaus`, hours: 2, practice: [`Design a daily practice routine: warm-up, technique, repertoire, and creative time`, `Record yourself practicing and identify one habit to improve`, `Slow a difficult passage to 50% tempo and play it perfectly, then gradually speed up`], challenge: `Create a 30-day practice plan with specific goals for each week, track your progress, and document what worked` },
      { title: `Performance and musicality — sharing your music`, hours: 3, practice: [`Perform 2 pieces for a friend or family member and ask for honest feedback`, `Record a video performance and watch it back critically`, `Play through nervousness: perform one piece without stopping even if you make mistakes`], challenge: `Prepare and deliver a 10-minute performance: choose 3 pieces of increasing difficulty, introduce each one, and play with expression and confidence` },
    ],
    science: [
      { title: `What is ${s}? — big ideas and why it matters`, hours: 1.5, practice: [`Define 10 core terms in ${s}$ and explain each in your own words`, `Draw a concept map connecting the 5 major themes of ${s}$`, `Explain how ${s}$ connects to everyday life with 3 concrete examples`], challenge: `Write a 500-word essay explaining the central question that ${s}$ tries to answer, and why it matters to society` },
      { title: `${cap} foundations — core principles and vocabulary`, hours: 2.5, practice: [`List and explain the 10 most important principles or laws in ${s}$`, `Create flashcards for 30 key terms with definitions and examples`, `Solve 5 basic problems applying fundamental ${s}$ principles`], challenge: `Write a study guide covering the 20 most essential concepts in ${s}$ foundations, with diagrams and worked examples for each` },
      { title: `Core concepts — building mental models`, hours: 3, practice: [`Explain 5 key mechanisms or processes in ${s}$ using your own diagrams`, `Connect 3 pairs of related concepts (cause-effect, part-whole, process-product)`, `Solve 5 intermediate problems that require combining multiple concepts`], challenge: `Create an illustrated concept web showing how at least 8 core concepts in ${s}$ relate to each other, with brief explanations of each connection` },
      { title: `Lab skills and experimental thinking`, hours: 2.5, practice: [`Design a simple experiment to test a hypothesis in ${s}$, identifying variables and controls`, `Analyze a dataset: identify trends, outliers, and draw conclusions`, `Write a lab report following the scientific method: hypothesis, method, results, conclusion`], challenge: `Design and execute a mini research project: formulate a hypothesis, design the experiment, collect data, perform basic analysis, and present findings` },
      { title: `Intermediate problem solving`, hours: 3, practice: [`Solve 5 multi-step problems that combine 2+ concepts from ${s}$`, `Explain the solution to a complex problem step-by-step, justifying each decision`, `Find and fix errors in 3 worked solutions`], challenge: `Tackle an olympiad-level or competition-style ${s}$ problem: break it into sub-problems, solve each, and synthesize the final answer with full justification` },
      { title: `${cap} in the real world — applications and implications`, hours: 2.5, practice: [`Research a real-world application of ${s}$ and write a summary of how it works`, `Identify 3 ethical or societal implications of ${s}$ research or application`, `Interview or read about a professional working in a ${s}$-related field`], challenge: `Write a policy brief or op-ed on a current issue at the intersection of ${s}$ and society, using scientific evidence to support your argument` },
      { title: `Advanced topics and current frontiers`, hours: 3, practice: [`Summarize a recent research paper or discovery in ${s}$ for a general audience`, `Compare 2 competing theories or models in ${s}$ and evaluate the evidence for each`, `Explain an advanced concept in ${s}$ using only analogies and simple language`], challenge: `Write a 1000-word review essay on the current frontiers of ${s}$: what we know, what we don't, and what questions drive current research` },
      { title: `Capstone — deep dive into a topic you choose`, hours: 4, practice: [`Choose a specific subtopic in ${s}$ and create a detailed study plan`, `Write a literature review of 5 sources on your chosen subtopic`, `Prepare and deliver a presentation explaining your subtopic with visual aids`], challenge: `Complete a mini research project: formulate an original question, review relevant literature, design an approach, and present your findings in a written report with figures` },
    ],
    math: [
      { title: `What is ${s}? — the big picture and motivation`, hours: 1.5, practice: [`Explain why ${s}$ matters with 3 real-world applications`, `List the 10 most important definitions or theorems in ${s}$`, `Draw a prerequisite map: what math topics does ${s}$ build on?`], challenge: `Write an essay explaining the central problem ${s}$ solves and how it connects to other branches of mathematics` },
      { title: `${cap} foundations — definitions, notation, and basic theorems`, hours: 2.5, practice: [`State and prove 3 fundamental theorems or properties in ${s}$`, `Translate 5 word problems into ${s}$ notation and solve them`, `Create a reference sheet of all key definitions and formulas`], challenge: `Prove 3 fundamental results in ${s}$ from first principles, with clear logical reasoning at each step` },
      { title: `Core techniques and problem-solving strategies`, hours: 3, practice: [`Solve 10 problems using the 3 most important techniques in ${s}$`, `Classify 5 problems by which technique applies and justify your classification`, `Solve 3 proof-based problems using direct proof, contradiction, or induction`], challenge: `Create a problem-solving strategy guide for ${s}$: when to use each technique, with a worked example and common pitfalls for each` },
      { title: `Proof writing and mathematical reasoning`, hours: 2.5, practice: [`Write 5 proofs: 2 direct, 1 by contradiction, 1 by contrapositive, 1 by induction`, `Find and fix errors in 3 incorrect proofs`, `Write a proof that requires combining two different proof techniques`], challenge: `Prove a non-trivial theorem in ${s}$ that requires creative problem-solving: construct the proof, then write an explanation of your key insight` },
      { title: `${s}$ in action — applications and computation`, hours: 2.5, practice: [`Apply ${s}$ to solve a real problem from physics, engineering, or data science`, `Implement a basic ${s}$ algorithm in code and verify the results`, `Visualize a ${s}$ concept using graphs, diagrams, or dynamic geometry software`], challenge: `Use ${s}$ to model a real-world phenomenon: set up the mathematical model, solve it, interpret the results, and evaluate the model's limitations` },
      { title: `Connecting ${s}$ to other mathematics`, hours: 3, practice: [`Explain how ${s}$ connects to at least 2 other branches of math`, `Solve a problem that requires both ${s}$ and concepts from another area`, `Write about the historical development of ${s}$ and key contributors`], challenge: `Explore a research-level connection between ${s}$ and another field: read an accessible paper, summarize the key idea, and explain it to someone outside the field` },
      { title: `Advanced problems and competition-style challenges`, hours: 3, practice: [`Solve 5 problems from math competitions (AMC, Putnam, or similar) using ${s}$`, `Find 3 different approaches to the same problem and compare their elegance`, `Create your own original problem that requires ${s}$ to solve`], challenge: `Solve a hard competition problem or textbook exercise that requires multiple insights: document your thought process, false starts, and final solution` },
      { title: `Capstone — deep understanding and original work`, hours: 4, practice: [`Write a tutorial explaining a core ${s}$ topic for an intelligent layperson`, `Create a visual/spatial explanation of an abstract ${s}$ concept`, `Prepare and deliver a 20-minute lecture on a ${s}$ topic of your choice`], challenge: `Write a short expository paper on an interesting result in ${s}$: motivation, statement, proof sketch, applications, and open questions — in the style of a mathematical essay` },
    ],
    creative: [
      { title: `Introduction to ${s} — what it is, tools, and getting started`, hours: 1.5, practice: [`Gather your basic materials/tools and set up your workspace`, `Study 5 examples of great ${s}$ work and write notes on what makes each effective`, `Create your first piece with no expectations — just explore the medium`], challenge: `Create a before/after comparison: your very first piece vs. a piece after 30 minutes of focused practice. Analyze what improved.` },
      { title: `${cap} fundamentals — core techniques and principles`, hours: 2.5, practice: [`Practice 3 fundamental techniques for 20 minutes each, documenting your progress`, `Recreate a simple reference piece, matching it as closely as possible`, `Learn and apply the rules of composition, lighting, or balance in 3 practice pieces`], challenge: `Complete a mini-project that demonstrates mastery of 3 core techniques: plan, execute, and self-critique` },
      { title: `Developing your eye — observation and analysis`, hours: 2.5, practice: [`Do a 30-minute observation exercise: sketch/photograph/build 10 quick studies of everyday objects`, `Analyze a professional work in your field: break down technique, composition, and creative choices`, `Compare your work to a professional reference and write 5 specific improvements to make`], challenge: `Create a detailed study of light, texture, or form: produce 5 pieces that specifically demonstrate improved observational skill` },
      { title: `Intermediate techniques and personal style`, hours: 3, practice: [`Learn 3 intermediate techniques and apply each to a separate practice piece`, `Experiment with 3 different styles or approaches and evaluate which suits your vision`, `Combine 2 techniques into a single piece that shows creative integration`], challenge: `Develop a personal project with a consistent theme or style: create a series of 3 related pieces that show your evolving artistic voice` },
      { title: `${s} and technology — modern tools and workflows`, hours: 2.5, practice: [`Learn 3 digital tools or techniques relevant to ${s}$ and create a practice piece with each`, `Digitize or enhance a traditional piece using modern tools`, `Research how professionals in ${s}$ use technology in their workflow`], challenge: `Complete a project that blends traditional and digital techniques, demonstrating fluency with both` },
      { title: `Storytelling and meaning in ${s}$`, hours: 2.5, practice: [`Create 3 pieces that each tell a different story or convey a different emotion`, `Write an artist statement explaining the intention behind one of your pieces`, `Study how 3 famous works in ${s}$ communicate meaning through technique`], challenge: `Create a narrative series: 5 pieces that together tell a story or explore a theme, with an accompanying artist statement` },
      { title: `Feedback, critique, and improvement`, hours: 2, practice: [`Share a piece with a peer and give constructive feedback on theirs`, `Write a detailed self-critique of one of your works: strengths, weaknesses, and specific improvements`, `Revisit an older piece and remake it with your current skills`], challenge: `Complete a full critique cycle: create a piece, get 2+ critiques, revise based on feedback, and document what changed and why` },
      { title: `Portfolio and presentation — showing your work`, hours: 3, practice: [`Select your 5 best pieces and write descriptions for each`, `Create a simple portfolio layout or gallery arrangement`, `Present your work to someone and practice explaining your creative process`], challenge: `Prepare a complete portfolio of 8-10 pieces with artist statements, arrange them for maximum impact, and deliver a 10-minute presentation of your work` },
    ],
    humanities: [
      { title: `What is ${s}? — central questions and why they matter`, hours: 1.5, practice: [`Identify the 5 most important questions or debates in ${s}$`, `Write a paragraph explaining why ${s}$ matters to contemporary society`, `Map the key schools of thought or periods in ${s}$`], challenge: `Write a 500-word essay on the most important unresolved question in ${s}$, presenting at least 2 competing perspectives` },
      { title: `${cap} foundations — key concepts, thinkers, and texts`, hours: 2.5, practice: [`Summarize the core arguments of 3 foundational thinkers or texts in ${s}$`, `Define 20 key terms in ${s}$ with precise, nuanced definitions`, `Compare 2 major theoretical frameworks and explain where they agree and disagree`], challenge: `Write a critical analysis of a foundational text in ${s}$: identify its thesis, evaluate its argument, and assess its lasting influence` },
      { title: `Core themes and debates`, hours: 3, practice: [`Outline 3 major debates in ${s}$ with arguments for each side`, `Write a 300-word analysis of a primary source or historical event in ${s}$`, `Connect a concept from ${s}$ to a current event or contemporary issue`], challenge: `Write a 1000-word analytical essay that takes a clear position on a major ${s}$ debate, using specific evidence and addressing counterarguments` },
      { title: `Critical reading and analytical writing`, hours: 2.5, practice: [`Analyze the argument structure of an academic article: claims, evidence, and reasoning`, `Write a close reading of a short passage, identifying rhetorical strategies and their effects`, `Revise a draft essay: improve the thesis, strengthen evidence, and fix logical gaps`], challenge: `Write a 1500-word research essay with a clear thesis, primary sources, secondary scholarship, and proper citation` },
      { title: `${s}$ and its interdisciplinary connections`, hours: 2.5, practice: [`Explain how ${s}$ connects to at least 2 other disciplines (science, politics, art)`, `Find a case study where ${s}$ insights were applied to solve a real problem`, `Read a cross-disciplinary article that bridges ${s}$ and another field`], challenge: `Write an interdisciplinary analysis: choose a problem that requires insights from ${s}$ AND another discipline, and argue for a solution drawing on both` },
      { title: `Historical and cultural context`, hours: 2.5, practice: [`Create a timeline of the 10 most important events or developments in ${s}$`, `Explain how the historical context of a key work or event shaped its significance`, `Compare how ${s}$ is understood in 2 different cultural contexts`], challenge: `Write a historical analysis that traces how a key idea in ${s}$ evolved over time, with specific examples from at least 3 different periods` },
      { title: `${s}$ in the contemporary world`, hours: 2.5, practice: [`Research a current controversy in ${s}$ and present both sides fairly`, `Write an op-ed applying ${s}$ insights to a current policy debate`, `Analyze a piece of popular media through the lens of ${s}$`], challenge: `Write a policy brief or public-facing article that uses ${s}$ scholarship to address a contemporary issue, with a clear argument and actionable recommendations` },
      { title: `Capstone — original analysis and scholarly voice`, hours: 4, practice: [`Develop a research question and preliminary thesis for an original ${s}$ analysis`, `Write a literature review of 5 scholarly sources on your topic`, `Draft a conclusion that synthesizes your argument and acknowledges limitations`], challenge: `Write a complete scholarly essay (2000+ words) with introduction, literature review, original analysis, and conclusion — suitable for an undergraduate seminar` },
    ],
    general: [
      { title: `What is ${s}? — overview and why it matters`, hours: 1.5, practice: [`Define 10 key terms in ${s}$ and explain each in your own words`, `Explain ${s}$ to someone completely unfamiliar with it in 3 paragraphs`, `Identify the 3 most important ideas or skills in ${s}$`], challenge: `Write a comprehensive FAQ covering the 10 most common questions beginners ask about ${s}$` },
      { title: `${cap} foundations — core principles and essential knowledge`, hours: 2.5, practice: [`List and explain the 10 most fundamental principles of ${s}$`, `Create a study guide covering the essential vocabulary and concepts`, `Solve or complete 5 beginner-level exercises in ${s}$`], challenge: `Create a complete beginner's guide to ${s}$: cover all essential concepts, with examples, diagrams, and practice exercises` },
      { title: `Building skills — practice and application`, hours: 3, practice: [`Apply core ${s}$ principles to 3 different real-world scenarios`, `Find and analyze 3 expert-level examples of ${s}$ in practice`, `Teach a concept from ${s}$ to someone else and note where they struggle`], challenge: `Complete a significant practical exercise that demonstrates understanding of 5+ core ${s}$ concepts working together` },
      { title: `Intermediate challenges — deepening understanding`, hours: 2.5, practice: [`Tackle 3 problems that require combining multiple ${s}$ concepts`, `Identify common misconceptions in ${s}$ and explain why they're wrong`, `Compare 2 different approaches or perspectives within ${s}$`], challenge: `Write an analytical essay examining a complex issue in ${s}$: present multiple perspectives, evaluate evidence, and defend your position` },
      { title: `${s}$ in context — real-world applications and relevance`, hours: 2.5, practice: [`Research 3 professional fields that use ${s}$ and explain how`, `Find a current event or trend connected to ${s}$ and analyze it`, `Interview or read about an expert in a ${s}$-related field`], challenge: `Write a case study connecting ${s}$ to a real-world problem: define the problem, apply ${s}$ principles, and propose a solution` },
      { title: `Advanced topics and critical thinking`, hours: 3, practice: [`Analyze an advanced topic in ${s}$ from 3 different angles`, `Evaluate the strengths and limitations of a major theory or approach in ${s}$`, `Create original content (essay, project, or analysis) demonstrating advanced understanding`], challenge: `Write a 1500-word critical analysis of an advanced ${s}$ topic, drawing on multiple sources and demonstrating original thinking` },
      { title: `Creative application and synthesis`, hours: 2.5, practice: [`Design an original project that applies ${s}$ to a problem you care about`, `Connect ${s}$ to at least 2 other fields or disciplines`, `Write about the future of ${s}$: where it's heading and what questions remain`], challenge: `Complete an original project that synthesizes ${s}$ with another area of knowledge, producing something new` },
      { title: `Capstone — mastery demonstration`, hours: 4, practice: [`Create a comprehensive portfolio or project demonstrating your ${s}$ journey`, `Prepare and deliver a presentation on an advanced ${s}$ topic`, `Write a reflective essay on what you learned, what surprised you, and where to go next`], challenge: `Design, execute, and present a capstone project in ${s}$ that demonstrates deep understanding, original thinking, and real-world application` },
    ],
  };
  return (templates[domain] ?? templates.general).map((t, i, arr) => ({
    ...t,
    level: levelFor(t.title, i / (arr.length - 1)),
  }));
}

/**
 * Generate practice problems and a challenge for any topic, based on its
 * title and the detected domain. Used to enrich syllabus-parsed topics
 * that don't already have practice/challenge data.
 */
function generatePracticeProblems(
  topicTitle: string,
  domain: Domain,
): { practice: string[]; challenge: string } {
  const t = topicTitle.slice(0, 80);
  switch (domain) {
    case "programming":
      return {
        practice: [
          `Write a short program demonstrating ${t} with working code and comments`,
          `Explain ${t} in your own words, listing 3 key concepts and why they matter`,
          `Find and fix 2 bugs in a code snippet that uses ${t}`,
        ],
        challenge: `Design and implement a real-world feature using ${t} — include edge cases, error handling, and at least one test`,
      };
    case "math":
      return {
        practice: [
          `Solve 3 problems related to ${t}, showing all steps clearly`,
          `Explain the intuition behind ${t} — what does it represent geometrically or numerically?`,
          `Prove or disprove a simple claim about ${t} using formal reasoning`,
        ],
        challenge: `Solve a challenging multi-step problem involving ${t} that requires combining it with at least one other concept`,
      };
    case "science":
      return {
        practice: [
          `Describe ${t} with a real-world example or experiment`,
          `List the key terms and definitions related to ${t}`,
          `Explain how ${t} connects to everyday life or current research`,
        ],
        challenge: `Design an experiment or analysis that applies ${t} to answer a specific scientific question`,
      };
    case "language":
      return {
        practice: [
          `Write 5 sentences using ${t} in context`,
          `Explain the grammar rules behind ${t} with examples`,
          `Translate a short paragraph that practices ${t}`,
        ],
        challenge: `Write a short essay or conversation that naturally incorporates ${t} with correct usage`,
      };
    case "music":
      return {
        practice: [
          `Practice ${t} slowly, then gradually increase tempo`,
          `Explain the theory behind ${t} and why it sounds the way it does`,
          `Record yourself performing ${t} and identify areas for improvement`,
        ],
        challenge: `Perform ${t} in a musical context — combine it with other elements to create a complete piece`,
      };
    default:
      return {
        practice: [
          `Summarize the key ideas of ${t} in your own words`,
          `Create a study note or mind map covering ${t}`,
          `Apply ${t} to a practical scenario or real-world situation`,
        ],
        challenge: `Write a comprehensive explanation of ${t} that someone new to the subject could understand`,
      };
  }
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
    // Single-subject mode: classify the subject and build a domain-specific
    // fundamentals-to-advanced scaffold with real practice problems.
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
    const scaffold = buildDomainScaffold(s, cap);
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
  // Enrich syllabus-parsed topics with practice/challenge if missing.
  const enriched = merged.map((t) => {
    if (t.practice && t.practice.length > 0) return t;
    const subject = title || cleaned.split("\n")[0]?.trim() || "the subject";
    const domain = classifySubject(subject);
    const pp = generatePracticeProblems(t.title, domain);
    return { ...t, practice: pp.practice, challenge: pp.challenge };
  });
  return { title, topics: enriched };

  // Title priority: course-code/header line > first clean topic > raw first line.
  if (!title) {
    const base = titleSource || unique[0]?.title || lines[0] || "Untitled plan";
    title = makeTitle(base);
  }
  return { title, topics };
}
