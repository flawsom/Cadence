/**
 * Ingestion quality harness — runs REAL syllabi through Cadence's actual
 * fallback engine (heuristicParse + createPlan's sequencing/chunking logic,
 * mirrored here 1:1) and prints the resulting schedule preview.
 *
 * Run: bun scripts/ingest-demo.ts
 */
import { heuristicParse } from "../src/convex/lib";

const SYLLABI: { name: string; input: string; hoursPerDay: number; targetDays: number }[] = [
  {
    name: "University course outline (MIT 6.006-style, deliberately NOT in teaching order)",
    hoursPerDay: 1.5,
    targetDays: 21,
    input: `Syllabus — Introduction to Algorithms
Topics: Hashing, Sorting, Shortest paths, Asymptotic complexity, Binary search trees, Greedy algorithms, Graph traversals, Divide and conquer, Maximum flow`,
  },
  {
    name: "Certification blueprint (AWS Developer Associate, DVA-C02 domains)",
    hoursPerDay: 2,
    targetDays: 30,
    input: `Exam DVA-C02 blueprint:
Domain 4: Troubleshooting and Optimization (30%)
Domain 1: Development with AWS Services (32%)
Domain 2: Security (26%)
Domain 3: Deployment (12%)`,
  },
  {
    name: "No syllabus at all — just an intention",
    hoursPerDay: 1,
    targetDays: 14,
    input: "I want to learn Rust",
  },
  {
    name: "Scanned-handout vibe — messy semicolon biology notes on ONE line",
    hoursPerDay: 1.5,
    targetDays: 21,
    input:
      "bio unit; photosynthesis light reactions; cellular respiration; intro to cells and organelles; mitosis and meiosis; mendelian genetics; dna structure and replication; protein synthesis; evolution and natural selection; ecosystems and energy flow",
  },
];

/** Mirror of createPlan: sequence by level (stable), split big topics into parts. */
function preview(topics: { title: string; hours: number; level: number }[], hoursPerDay: number) {
  const sequenced = topics
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => a.level - b.level || a.i - b.i);

  const chunks: { title: string; hours: number }[] = [];
  for (const t of sequenced) {
    const h = Math.min(12, Math.max(0.25, t.hours));
    const parts = Math.max(1, Math.ceil(h / hoursPerDay - 0.001));
    const partHours = Math.max(0.25, Math.round((h / parts) * 4) / 4);
    for (let p = 0; p < parts; p++) {
      chunks.push({
        title: parts > 1 ? `${t.title} (part ${p + 1} of ${parts})` : t.title,
        hours: partHours,
      });
    }
  }

  // Lay chunks onto days, never exceeding hoursPerDay.
  const days: { index: number; items: string[] }[] = [];
  let remaining = hoursPerDay;
  for (const c of chunks) {
    let day = days[days.length - 1];
    if (!day || remaining < c.hours - 0.001) {
      day = { index: days.length + 1, items: [] };
      days.push(day);
      remaining = hoursPerDay;
    }
    day.items.push(`${c.title} (${c.hours}h)`);
    remaining -= c.hours;
  }
  return { sequenced, days };
}

for (const s of SYLLABI) {
  console.log(`\n${"=".repeat(72)}\n${s.name}\n${"-".repeat(72)}`);
  const { title, topics } = heuristicParse(s.input);
  console.log(`Plan title: ${title}`);
  console.log("Sequenced topics:");
  for (const t of preview(topics, s.hoursPerDay).sequenced) {
    console.log(`  L${t.level}  ${t.title}  ·  ${t.hours}h`);
  }
  const { days } = preview(topics, s.hoursPerDay);
  console.log(`\nSchedule @${s.hoursPerDay}h/day → ${days.length} day(s)` +
    (days.length > s.targetDays ? ` (⚠ runs ${days.length - s.targetDays} past your ${s.targetDays}-day target)` : ""));
  for (const d of days.slice(0, 3)) {
    console.log(`  Day ${d.index}: ${d.items.join(" · ")}`);
  }
  if (days.length > 3) console.log(`  … +${days.length - 3} more days`);
}

// ── Real university syllabus fixtures (the brutal ones) ──────────────────
import { readFileSync } from "node:fs";
for (const [file, hpd, target] of [
  ["pcar2004-cloud.txt", 2, 30],
  ["dspe3007-image.txt", 1.5, 21],
  ["cspc2003-oop.txt", 2, 28],
] as const) {
  const input = readFileSync(`scripts/fixtures/${file}`, "utf8");
  console.log(`\n${"=".repeat(72)}\nFIXTURE ${file}  (@${hpd}h/day, target ${target}d)\n${"-".repeat(72)}`);
  const { title, topics } = heuristicParse(input);
  console.log(`Plan title: ${title}   (${topics.length} topics)`);
  for (const t of preview(topics, hpd).sequenced.slice(0, 14)) {
    console.log(`  L${t.level}  ${t.title.slice(0, 70)}  ·  ${t.hours}h`);
  }
  if (topics.length > 14) console.log(`  … +${topics.length - 14} more`);
}
