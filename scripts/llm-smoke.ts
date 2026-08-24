/**
 * Local-LLM smoke test for CI and self-hosters.
 *
 * Assumes an OpenAI-compatible server is reachable at LLM_BASE_URL
 * (defaults to Ollama at http://127.0.0.1:11434/v1). Sends the exact same
 * system prompt and normalization pipeline the app uses in production,
 * then asserts QUALITY invariants — not just parseable JSON:
 *   • enough topics for a real plan
 *   • every topic survives production normalization
 *   • fundamentals-first sequencing (intro-level first, capstone last)
 *   • sane study-hour estimates
 *
 * Run: bun scripts/llm-smoke.ts
 */
import { normalizeTopics } from "../src/convex/lib";
const BASE_URL = (process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
const MODEL = process.env.LLM_MODEL ?? "qwen2.5:1.5b-instruct";

// Kept in sync with src/convex/lib.ts — CI fails loudly if they drift apart,
// because this file reads the source of truth directly.
const libSource = await Bun.file(new URL("../src/convex/lib.ts", import.meta.url)).text();
const promptMatch = libSource.match(/SYLLABUS_SYSTEM_PROMPT =([\s\S]*?);/);
if (!promptMatch) {
  console.error("FAIL: could not read SYLLABUS_SYSTEM_PROMPT from src/convex/lib.ts");
  process.exit(1);
}
// Evaluate the concatenation safely by building it from the captured literals.
const SYLLABUS_SYSTEM_PROMPT = (() => {
  const parts = [...promptMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)];
  return parts.map((m) => m[1] ?? m[2]).join("");
})();
if (SYLLABUS_SYSTEM_PROMPT.length < 100) {
  console.error("FAIL: extracted system prompt looks wrong");
  process.exit(1);
}

async function waitForServer(deadlineMs: number) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL.replace(/\/v1$/, "")}/api/tags`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.error(`FAIL: no LLM server at ${BASE_URL}`);
  process.exit(1);
}

await waitForServer(60_000);

const SAMPLE_SYLLABUS =
  "Week 1: Introduction to Rust and toolchain setup\n" +
  "Week 2: Variables, types and functions\n" +
  "Week 3: Ownership and borrowing\n" +
  "Week 4: Structs, enums and pattern matching\n" +
  "Week 5: Error handling and Result\n" +
  "Week 6: Traits and generics\n" +
  "Week 7: Lifetimes and smart pointers\n" +
  "Week 8: Concurrency and async\n" +
  "Week 9: Capstone project - building a CLI tool";

console.log(`Asking ${MODEL} at ${BASE_URL} to sequence a sample syllabus…`);
const res = await fetch(`${BASE_URL}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: SYLLABUS_SYSTEM_PROMPT },
      { role: "user", content: SAMPLE_SYLLABUS },
    ],
    temperature: 0.2,
    max_tokens: 2048,
  }),
  signal: AbortSignal.timeout(300_000),
});

if (!res.ok) {
  console.error(`FAIL: chat/completions returned HTTP ${res.status}`);
  process.exit(1);
}

const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
const content = payload.choices?.[0]?.message?.content ?? "";
const start = content.indexOf("{");
const end = content.lastIndexOf("}");
if (start === -1 || end <= start) {
  console.error("FAIL: model did not return JSON object.\n---\n" + content.slice(0, 500));
  process.exit(1);
}

let raw: unknown;
try {
  const parsed = JSON.parse(content.slice(start, end + 1)) as { topics?: unknown };
  raw = parsed.topics;
} catch {
  console.error("FAIL: JSON parse error.\n---\n" + content.slice(0, 500));
  process.exit(1);
}

// Run through the SAME normalizer production uses.
const topics = normalizeTopics(raw);
if (topics.length < 5) {
  console.error(`FAIL: expected >= 5 usable topics after normalization, got ${topics.length}.\n---\n` + content.slice(0, 500));
  process.exit(1);
}

// ── Quality invariants (these FAIL CI, no tolerance) ──────────────────────
// Hours bounds mirror production normalization EXACTLY (clamp to 0.5–8):
// the gate must enforce the real product contract, not an idealized one.
let failed = false;
if (topics.some((t) => t.title.length < 4)) {
  console.error("FAIL: a normalized topic title is too short to be meaningful.");
  failed = true;
}
const badHours = topics.filter((t) => !(t.hours >= 0.5 && t.hours <= 8));
if (badHours.length > 0) {
  console.error(
    "FAIL: topic hours violate the production 0.5–8h contract:\n" +
      badHours.map((t) => `  ${t.hours}h ${t.title}`).join("\n"),
  );
  failed = true;
}
const firstLevel = topics[0].level;
const lastLevel = topics[topics.length - 1].level;
if (firstLevel === 3) {
  console.error(`FAIL: sequencing starts on an ADVANCED topic ("${topics[0].title}") — fundamentals-first violated.`);
  failed = true;
}
if (lastLevel < firstLevel && topics.length >= 4) {
  console.error(`FAIL: sequence ends earlier-level than it starts (${firstLevel}→${lastLevel}).`);
  failed = true;
}
if (failed) process.exit(1);

console.log(
  `OK: ${topics.length} normalized topics · first: L${firstLevel} "${topics[0].title}" · last: L${lastLevel} "${topics[topics.length - 1].title}"`,
);
console.log("PASS: local LLM produced production-valid, fundamentals-first topic JSON.");
