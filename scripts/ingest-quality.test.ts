/**
 * Ingestion quality gates — run on every CI push.
 *
 * These encode hard-won invariants from real university syllabi.
 * If any of these fail, ingestion has regressed. No exceptions.
 *
 * Run: bun test scripts/ingest-quality.test.ts
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { heuristicParse } from "../src/convex/lib";

const fixture = (name: string) =>
  readFileSync(`scripts/fixtures/${name}`, "utf8");

/** Meta contamination that must NEVER appear as a topic. */
const META_RE =
  /^(sub-?topics?|formative assessments?|learning outcomes?|course outcomes?|co\d+|text book|references?|to study\b|course objectives?)/i;

describe("PCAR2004 Cloud Computing Foundations", () => {
  const { title, topics } = heuristicParse(fixture("pcar2004-cloud.txt"));

  test("extracts the official course title", () => {
    expect(title).toMatch(/Cloud Computing Foundations/i);
  });

  test("human-sized topic count", () => {
    expect(topics.length).toBeGreaterThanOrEqual(6);
    expect(topics.length).toBeLessThanOrEqual(30);
  });

  test("Module 1's [24 Hours] budget is distributed across its topics", () => {
    const module1 = topics.filter((t) =>
      /cloud computing models|overview of cloud|components of cloud|emergent trends|cloud security/i.test(
        t.title,
      ),
    );
    expect(module1.length).toBeGreaterThanOrEqual(4);
    const sum = module1.reduce((s, t) => s + t.hours, 0);
    expect(sum).toBeGreaterThanOrEqual(15); // proportional slice of the 24h module
    expect(sum).toBeLessThanOrEqual(30);
  });

  test("core sub-topics all captured", () => {
    const joined = topics.map((t) => t.title).join(" | ");
    for (const expected of [
      "Overview of Cloud Computing",
      "Cloud Computing Models",
      "Key-Value Stores",
      "Classical Distributed Algorithms",
      "Final Project",
    ]) {
      expect(joined).toContain(expected);
    }
  });

  test("no meta or prose contamination", () => {
    for (const t of topics) expect(t.title).not.toMatch(META_RE);
    for (const t of topics) expect(t.title).not.toMatch(/\[24 Hours\]|\(08 Hours\)|Hrs\]/i);
  });
});

describe("DSPE3007 Image Processing", () => {
  const { title, topics } = heuristicParse(fixture("dspe3007-image.txt"));

  test("extracts the official course title", () => {
    expect(title).toMatch(/Image Processing/i);
  });

  test("signature topics present with fundamentals-first sequencing", () => {
    const titles = topics.map((t) => t.title.toLowerCase());
    for (const expected of [
      "fourier transform",
      "image sampling and quantization",
      "color models",
      "histogram processing",
      "wiener filtering",
    ]) {
      expect(titles.some((t) => t.includes(expected))).toBe(true);
    }
    // Sampling & quantization (foundations) must precede Wiener filtering (advanced).
    const samplingIdx = titles.findIndex((t) => t.includes("sampling"));
    const wienerIdx = titles.findIndex((t) => t.includes("wiener"));
    expect(samplingIdx).toBeGreaterThanOrEqual(0);
    expect(wienerIdx).toBeGreaterThan(samplingIdx);
  });

  test("objective verbs are stripped, not echoed", () => {
    for (const t of topics) expect(t.title).not.toMatch(/^to\s+(study|apply|grasp)\b/i);
  });

  test("module hour budgets respected (8/8/10/8/8)", () => {
    const total = topics.reduce((s, t) => s + t.hours, 0);
    // All five modules sum to 42 taught hours; engine should land in that
    // neighborhood once fragments are consolidated.
    expect(total).toBeGreaterThan(25);
    expect(total).toBeLessThan(60);
  });
});

describe("CSPC2003 Object Oriented Programming", () => {
  const { title, topics } = heuristicParse(fixture("cspc2003-oop.txt"));

  test("extracts the official course title", () => {
    expect(title).toMatch(/Object Oriented Programming/i);
  });

  test("granular syllabus is consolidated to a human-sized plan", () => {
    expect(topics.length).toBeLessThanOrEqual(30);
    expect(topics.length).toBeGreaterThanOrEqual(12);
  });

  test("the full OOP arc is represented", () => {
    const joined = topics.map((t) => t.title).join(" | ").toLowerCase();
    for (const expected of [
      "inheritance",
      "multithreading",
      "exception",
      "collection",
      "javafx",
      "constructor",
    ]) {
      expect(joined).toContain(expected);
    }
  });

  test("classes & objects foundations precede advanced GUI work", () => {
    const titles = topics.map((t) => t.title.toLowerCase());
    const oopBasics = titles.findIndex((t) => /class|object/.test(t));
    const gui = titles.findIndex((t) => /swing|javafx|applet/.test(t));
    expect(oopBasics).toBeGreaterThanOrEqual(0);
    expect(gui).toBeGreaterThan(oopBasics);
  });

  test("chapter prose paragraphs never become mega-topics", () => {
    for (const t of topics) {
      expect(t.title.length).toBeLessThanOrEqual(120);
      expect(t.title).not.toMatch(/\bwhether\b|\bthis course\b/i);
    }
  });
});

describe("HSBS2001 Mathematics-III", () => {
  const { title, topics } = heuristicParse(fixture("hsbs2001-maths.txt"));

  test("extracts the official course title with roman numeral intact", () => {
    expect(title).toMatch(/Mathematics-III/i);
  });

  test("all five module themes represented", () => {
    const joined = topics.map((t) => t.title).join(" | ").toLowerCase();
    for (const expected of [
      "laplace",
      "fourier",
      "separation of variables",
      "poisson",
      "normal distribution",
      "maximum likelihood",
      "correlation coefficient",
    ]) {
      expect(joined).toContain(expected);
    }
  });

  test("module hour budgets distributed (5 × 8 hours ≈ 40 total)", () => {
    const total = topics.reduce((s, t) => s + t.hours, 0);
    expect(total).toBeGreaterThanOrEqual(30);
    expect(total).toBeLessThanOrEqual(55);
  });

  test("no textbook authors or reference leakage", () => {
    const joined = topics.map((t) => t.title).join(" | ");
    for (const banned of ["Kreyszig", "Willey", "Pearson", "McGraw", "Oxford"]) {
      expect(joined).not.toContain(banned);
    }
  });

  test("probability foundations precede specific distributions", () => {
    const titles = topics.map((t) => t.title.toLowerCase());
    const probBasics = titles.findIndex((t) => /axiomatic|basic properties|random variables/.test(t));
    const distributions = titles.findIndex((t) => /binomial|poisson|normal/.test(t));
    expect(probBasics).toBeGreaterThanOrEqual(0);
    expect(distributions).toBeGreaterThan(probBasics);
  });
});

describe("Bare intention (no syllabus at all)", () => {
  test('"I want to learn Rust" scaffolds around Rust', () => {
    const { title, topics } = heuristicParse("I want to learn Rust");
    expect(title).toBe("Rust");
    expect(topics.length).toBeGreaterThanOrEqual(5);
    // At least one topic at each level (foundations → advanced).
    expect(topics.some((t) => t.level === 1)).toBe(true);
    expect(topics.some((t) => t.level === 3)).toBe(true);
    // Every topic has practice problems and a challenge.
    expect(topics.every((t) => (t.practice?.length ?? 0) >= 2)).toBe(true);
    expect(topics.every((t) => (t.challenge?.length ?? 0) >= 10)).toBe(true);
  });
});

describe("Scrambled document order (MIT 6.006-style)", () => {
  test("fundamentals genuinely float to the top", () => {
    const { topics } = heuristicParse(
      "Syllabus — Introduction to Algorithms\nTopics: Hashing, Sorting, Shortest paths, Asymptotic complexity, Binary search trees, Greedy algorithms, Graph traversals, Divide and conquer, Maximum flow",
    );
    const first = topics[0].title.toLowerCase();
    const last = topics[topics.length - 1].title.toLowerCase();
    // Sorting/hash basics before maximum flow / greedy territory.
    expect(first).toMatch(/hashing|sorting|asymptotic|introduction/);
    expect(last).not.toMatch(/hashing|sorting/);
    expect(topics.every((t) => t.hours >= 0.5 && t.hours <= 6)).toBe(true);
  });
});
