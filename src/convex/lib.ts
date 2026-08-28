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
      const hours = Math.min(3, Math.max(0.25, Math.round(Number(t?.hours ?? 1.5) * 4) / 4));
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

export function diffDays(a: string, b: string): number {
  return Math.round((dayKeyToUtcMs(b) - dayKeyToUtcMs(a)) / DAY_MS);
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
      { title: `What is ${s}? — purpose, ecosystem, and first hello world`, hours: 0.5, practice: [`Set up a working ${s} development environment and run "hello world"`, `Write 1-line programs: print a number, print a calculation, print your name`, `List 5 things ${s} is used for in the real world`], challenge: `Install ${s}, run 3 different programs from online examples, and explain what each one does line by line` },
      { title: `Variables, data types, and basic input/output`, hours: 1, practice: [`Create variables of 5 different types and print them with labels`, `Write a program that takes user input and responds with a calculation`, `Convert between data types (string to number, number to string) and explain when each is needed`], challenge: `Build a unit converter: take a number and unit from the user, convert it to another unit, and display the result with proper formatting` },
      { title: `Conditionals and boolean logic — making decisions in code`, hours: 1, practice: [`Write 3 programs using if/else to handle different user inputs`, `Build a simple grading system: input a score, output the letter grade`, `Nest conditionals to handle multiple conditions and explain the logic flow`], challenge: `Build a mini calculator that takes two numbers and an operator, validates the input, handles errors, and supports +, -, *, /, and %` },
      { title: `Loops and iteration — repeating work efficiently`, hours: 1, practice: [`Write a loop that prints numbers 1 to 100 with labels`, `Calculate the factorial of 5 using a loop`, `Build a number-guessing game: random number, user guesses until correct`], challenge: `Build a multiplication table generator: input a number, output its full multiplication table formatted neatly, with a loop counter showing how many iterations it took` },
      { title: `Functions — organizing reusable logic`, hours: 1, practice: [`Write 5 functions: add, subtract, greet, calculate area, and reverse a string`, `Write a function that accepts another function as an argument (higher-order function)`, `Refactor a 50-line script into 3 focused functions with clear names`], challenge: `Build a math utility library with functions for: GCD, LCM, prime checking, Fibonacci, and prime factorization — with tests for each` },
      { title: `Lists, arrays, and collections — working with groups of data`, hours: 1.5, practice: [`Create, access, modify, and iterate through lists/arrays of different sizes`, `Write programs that: sort a list, find the max/min, remove duplicates, and flatten a nested list`, `Solve 3 array problems: rotate, merge sorted arrays, and find missing number`], challenge: `Implement a dynamic array from scratch that supports: append, insert, delete, resize, and search — with O(n) and O(1) operations explained` },
      { title: `Dictionaries, maps, and key-value data`, hours: 1, practice: [`Build a contact book: add, search, update, and delete entries using dictionaries`, `Count word frequency in a paragraph and display the top 5`, `Group a list of items by a shared property using a dictionary`], challenge: `Build a simple in-memory cache (LRU-style) using a dictionary: get, put, eviction on overflow, with time complexity analysis` },
      { title: `Error handling and debugging — writing robust code`, hours: 1, practice: [`Add try/catch to 3 programs that could fail (file reading, division, input parsing)`, `Read a stack trace from a broken program and identify the root cause`, `Write a program that validates user input and gives helpful error messages`], challenge: `Build a file-processing pipeline that handles: missing files, corrupt data, wrong formats, and permissions — with clear error messages and graceful recovery` },
      { title: `Working with files and external data`, hours: 1, practice: [`Read a CSV file, parse its contents, and display formatted results`, `Write a program that saves user data to a file and loads it back`, `Build a simple log file analyzer: count entries, find errors, generate a summary`], challenge: `Build a data pipeline: read CSV → clean → transform → write to JSON → generate summary report, with error handling at each step` },
      { title: `Object-oriented programming — classes, objects, and design`, hours: 1.5, practice: [`Design a class for a bank account: deposit, withdraw, get balance, with validation`, `Create a class hierarchy: Animal → Dog/Cat with inheritance and method overriding`, `Write unit tests for a class you built, covering normal and edge cases`], challenge: `Design and implement a library management system: Book, User, and Loan classes with relationships, borrowing rules, and overdue tracking` },
      { title: `Working with APIs and external services`, hours: 1, practice: [`Fetch data from a public API and display it in a formatted table`, `Build a CLI tool that queries a weather API and shows results`, `Implement retry logic: try 3 times with delays before failing`], challenge: `Build an API wrapper library: handle authentication, rate limiting, caching, error handling, and automatic retries — with documentation` },
      { title: `Testing and code quality — writing code you can trust`, hours: 1, practice: [`Write unit tests for 5 functions, covering normal cases and edge cases`, `Set up a test suite that runs automatically and shows pass/fail counts`, `Find and fix a bug using test-driven development: write test first, then fix code`], challenge: `Achieve 90%+ test coverage for a module: unit tests, integration tests, edge cases, and write a testing strategy document` },
      { title: `Capstone — build a real project from scratch`, hours: 2, practice: [`Plan the architecture: data model, main features, file structure, and error strategy`, `Implement core features with proper error handling and user input validation`, `Write a README explaining how to install, run, and extend your project`], challenge: `Design, build, and deploy a complete application that solves a real problem — something you could show in a portfolio or put on your resume` },
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
 * Generate practice problems and a challenge for any topic.
 * Detects the actual subject matter and generates genuinely specific problems.
 */
function generatePracticeProblems(
  topicTitle: string,
  _domain: Domain,
): { practice: string[]; challenge: string } {
  const t = topicTitle.slice(0, 80);
  const tl = t.toLowerCase();

  // ── Math: transforms, proofs, equations ──
  if (/\b(laplace|fourier|z.transform|transform|integral|derivative|differential|ode|pde|convolution|linearity|shifting|inverse.*(transform|laplace|fourier))\b/.test(tl)) {
    // Detect if the topic is a property/concept vs an operation
    const isProperty = /\b(linearity|shifting|convolution|inverse)\b/.test(tl);
    if (isProperty) {
      return {
        practice: [
          `Explain what ${t} means in the context of transforms — give a precise definition with an example`,
          `Apply ${t} to simplify a complex transform computation — show the before and after`,
          `State the formal property of ${t}, prove it for one case, and explain why it is useful`,
        ],
        challenge: `Derive the formal statement of ${t} from first principles, prove it, and apply it to solve a non-trivial problem that would be difficult without this property`,
      };
    }
    return {
      practice: [
        `Compute the ${t} of 3 different functions, showing every step of the calculation`,
        `Use ${t} to solve an ordinary differential equation — verify your answer by substituting back`,
        `Explain the physical meaning of ${t} — what does it tell us about the original function?`,
      ],
      challenge: `Solve a real-world engineering problem using ${t}: model a physical system as a differential equation, apply the transform, solve algebraically, and interpret the result in the original domain`,
    };
  }
  if (/\b(probability|conditional|bayes|independent|joint|mutual)\b/.test(tl)) {
    return {
      practice: [
        `Calculate ${t} for 3 different scenarios with given numerical values`,
        `Explain the difference between ${t} and marginal probability using a Venn diagram`,
        `Solve a word problem that requires applying ${t} to a real-world situation`,
      ],
      challenge: `Design a probability model for a complex real-world scenario, calculate ${t} and related quantities, and explain your assumptions`,
    };
  }
  if (/\b(distribution|binomial|poisson|normal|exponential|uniform|geometric|hypergeometric)\b/.test(tl)) {
    return {
      practice: [
        `Calculate the mean, variance, and standard deviation for ${t} with given parameters`,
        `Use ${t} to model a real-world phenomenon and justify why this distribution is appropriate`,
        `Find the probability of 3 different events using ${t} — show the formula and calculation`,
      ],
      challenge: `Compare ${t} with 2 other distributions for the same scenario — which fits best and why? Include numerical analysis`,
    };
  }
  if (/\b(statistics|regression|correlation|confidence interval|estimation|hypothesis testing|random sampling|mean|median|descriptive|inferential)\b/.test(tl)) {
    return {
      practice: [
        `Calculate ${t} from a given dataset of 10 values — show your work step by step`,
        `Explain what ${t} measures and give an example where it would be misleading`,
        `Interpret a real-world example of ${t} from a published study or report`,
      ],
      challenge: `Perform a complete statistical analysis: collect or use a dataset, calculate ${t}, interpret the results, and discuss limitations of your analysis`,
    };
  }
  if (/\b(matrix|matrices|eigenvalue|eigenvector|determinant|inverse matrix|transpose|linear transformation|vector space|svd|singular value)\b/.test(tl)) {
    return {
      practice: [
        `Perform ${t} on a 3x3 matrix — show every arithmetic step`,
        `Explain the geometric interpretation of ${t} in 2D and 3D space`,
        `Solve a system of linear equations using ${t}`,
      ],
      challenge: `Apply ${t} to a real-world problem in physics, computer graphics, or data science — show the setup, computation, and interpretation`,
    };
  }
  if (/\b(equation|solve|quadratic|polynomial|algebra|factor)\b/.test(tl)) {
    return {
      practice: [
        `Solve 3 equations of increasing difficulty involving ${t}`,
        `Explain the algebraic reasoning behind each step of solving ${t}`,
        `Verify your solutions by substituting back into the original equation`,
      ],
      challenge: `Solve a complex equation that requires multiple techniques, and explain why each technique is necessary`,
    };
  }
  if (/\b(series|sequence|convergence|sum|telescoping|geometric series)\b/.test(tl)) {
    return {
      practice: [
        `Determine whether the series ${t} converges or diverges — state the test you use`,
        `Calculate the sum of ${t} if it converges, showing all steps`,
        `Compare ${t} with a known series to establish convergence bounds`,
      ],
      challenge: `Analyze the convergence behavior of ${t} under different parameter values and create a summary table`,
    };
  }

  // ── Programming: code, implement, build ──
  if (/\b(implement|write|code|program|build|deploy|refactor|debug|test|function|class|method|api|algorithm|data structure|array|linked list|hash|sort|search|recursion|database|sql|query|stack|queue|tree|graph|heap)\b/.test(tl)) {
    return {
      practice: [
        `Implement ${t} from scratch — write working code with clear comments explaining each step`,
        `Explain the time and space complexity of your implementation and identify one optimization`,
        `Write 3 test cases that cover normal input, edge cases, and error conditions`,
      ],
      challenge: `Build a complete, production-quality implementation of ${t} with error handling, documentation, and a test suite`,
    };
  }
  if (/\b(inheritance|polymorphism|encapsulation|abstraction|interface|abstract|override|overload|oop|object.oriented)\b/.test(tl)) {
    return {
      practice: [
        `Design a class hierarchy demonstrating ${t} — write the actual class definitions with methods`,
        `Write a code example where ${t} solves a real problem, and explain why the alternative approach is worse`,
        `Identify and fix a design flaw in code that violates ${t} principles`,
      ],
      challenge: `Design and implement a small system that correctly applies ${t} across 3+ classes, with documentation explaining each design decision`,
    };
  }
  if (/\b(exception|error|try|catch|throw|handling|validation)\b/.test(tl)) {
    return {
      practice: [
        `Write code that properly handles 3 different types of errors using try/catch`,
        `Explain the difference between checked and unchecked exceptions with examples`,
        `Design an error-handling strategy for a file processing pipeline`,
      ],
      challenge: `Build a robust error-handling system with custom exception types, retry logic, and graceful degradation`,
    };
  }
  if (/\b(concurrency|thread|mutex|lock|deadlock|synchron|parallel|atomic)\b/.test(tl)) {
    return {
      practice: [
        `Write a concurrent program that demonstrates ${t} — identify where race conditions could occur`,
        `Explain a real-world scenario where ${t} is necessary and how to implement it safely`,
        `Debug a code snippet with a concurrency bug related to ${t}`,
      ],
      challenge: `Design and implement a thread-safe data structure that uses ${t} correctly`,
    };
  }

  // ── Science: explain, describe, analyze ──
  if (/\b(physics|force|mass|energy|momentum|velocity|gravity|newton|thermodynamics|electromagnet|quantum)\b/.test(tl)) {
    return {
      practice: [
        `Explain ${t} with a concrete real-world example, including the relevant formula and units`,
        `Solve a numerical problem involving ${t} — show all steps and check your answer`,
        `Describe an experiment that demonstrates ${t}`,
      ],
      challenge: `Analyze a real-world physical system using ${t}: set up the model, solve it, and discuss assumptions and limitations`,
    };
  }
  if (/\b(chemistry|molecule|atom|reaction|bond|element|compound|organic|inorganic|solution|acid|base)\b/.test(tl)) {
    return {
      practice: [
        `Describe ${t} at the molecular level, including diagrams of key structures`,
        `Predict the outcome of a chemical process involving ${t} and explain your reasoning`,
        `Connect ${t} to a real-world application in medicine, industry, or the environment`,
      ],
      challenge: `Design a laboratory procedure or analysis that applies ${t}`,
    };
  }
  if (/\b(biology|cell|dna|rna|protein|gene|nucleus|mitosis|meiosis|evolution|ecology|organism)\b/.test(tl)) {
    return {
      practice: [
        `Describe ${t} with labeled diagrams and explain each component's role`,
        `Explain how ${t} relates to health, disease, or environmental science`,
        `Compare ${t} across different organisms or conditions`,
      ],
      challenge: `Analyze a biological research question related to ${t} using available data or literature`,
    };
  }
  if (/\b(image|pixel|filter|convolution|kernel|blur|sharpen|edge|noise|histogram|segmentation|enhancement|restoration|compression|wavelet|fourier|dct|sampling|quantization|color model)\b/.test(tl)) {
    return {
      practice: [
        `Explain ${t} at the mathematical level — what formula or operation is involved?`,
        `Describe the effect of ${t} on an image using specific numerical examples`,
        `Compare ${t} with an alternative approach — when would you choose one over the other?`,
      ],
      challenge: `Apply ${t} to a real image processing task: describe the input, the process, expected output, and potential artifacts`,
    };
  }
  if (/\b(network|tcp|udp|ip|packet|protocol|socket|port|dns|http|osi|cloud|iaas|paas|saas|distributed|mapreduce|gossip|key.value|serverless|container|docker|kubernetes)\b/.test(tl)) {
    return {
      practice: [
        `Explain ${t} with a sequence diagram or flowchart showing how it works step by step`,
        `Compare ${t} with an alternative approach — what are the tradeoffs?`,
        `Describe a real-world scenario where ${t} is used and why it was chosen`,
      ],
      challenge: `Design a system architecture that uses ${t} — explain your choices, draw the components, and discuss scalability`,
    };
  }

  // ── Music ──
  if (/\b(scale|chord|interval|note|pitch|harmony|melody|rhythm|tempo|key|major|minor|mode|arpeggio|cadence)\b/.test(tl)) {
    return {
      practice: [
        `Play or sing ${t} slowly, then analyze the intervals between each note`,
        `Write a short musical phrase that demonstrates ${t} in context`,
        `Explain the theory behind ${t} — why does it sound the way it does?`,
      ],
      challenge: `Compose a short piece that prominently features ${t} and explain your compositional choices`,
    };
  }

  // ── Language learning ──
  if (/\b(grammar|syntax|tense|verb|noun|adjective|conjugat|declension|writing|essay|paragraph|thesis|vocabulary|word|phrase|idiom)\b/.test(tl)) {
    return {
      practice: [
        `Write 5 original sentences that correctly use ${t}`,
        `Identify and correct 3 errors related to ${t} in sample sentences`,
        `Explain the rule behind ${t} with examples in both formal and informal contexts`,
      ],
      challenge: `Write a short paragraph or essay that naturally demonstrates mastery of ${t}`,
    };
  }

  // ── Generic fallback: use the topic title to make specific problems ──
  return {
    practice: [
      `Explain ${t} in your own words — what is it, why does it matter, and how does it work?`,
      `Create a study note for ${t} with key definitions, 3 examples, and common pitfalls`,
      `Apply ${t} to solve a concrete problem or answer a specific question`,
    ],
    challenge: `Write a comprehensive guide to ${t} that covers: definition, key concepts, examples, applications, common mistakes, and how it connects to the broader subject`,
  };
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
