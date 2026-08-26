/**
 * Built-in evaluation engine — provides meaningful, structured feedback
 * on any answer without requiring an LLM. Works 100% offline, zero deps.
 *
 * Scoring is calibrated so that:
 *  - A blank/irrelevant answer scores 0-10
 *  - A one-liner scores 15-30
 *  - A solid paragraph scores 40-60
 *  - A comprehensive multi-paragraph answer scores 65-85
 *  - An expert-level essay scores 85-100
 */

export interface EvalResult {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer?: string;
  explanation: string;
  diagram?: string;
  equations?: string[];
}

// ── Structural analysis helpers ────────────────────────────────────────

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sentenceCount(text: string): number {
  return (text.match(/[.!?]+/g) ?? []).length || 1;
}

function paragraphCount(text: string): number {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 10).length || 1;
}

function hasExamples(text: string): boolean {
  return /\b(example|for instance|such as|e\.g\.|like|including|specifically|consider|imagine|suppose|take|an example|one example|for example)\b/i.test(text);
}

function hasReasoning(text: string): boolean {
  return /\b(because|therefore|thus|hence|since|this means|the reason|as a result|consequently|this shows|this demonstrates|in order to|so that|this is because|the key reason|the purpose|this ensures|this allows|this enables)\b/i.test(text);
}

function hasStructure(text: string): boolean {
  return /\n\s*[\d•·\-]\s*[.)]/m.test(text) || paragraphCount(text) >= 2;
}

function hasDefinition(text: string): boolean {
  return /\b(is defined as|refers to|means|can be described as|is a |is the |is known as|essentially|fundamentally|basically|in essence|by definition)\b/i.test(text);
}

function hasComparison(text: string): boolean {
  return /\b(compar|differ|similar|unlike|whereas|while|on the other hand|in contrast|however|but|although|versus|vs\.?|advantage|disadvantage|strength|weakness|pros? and cons?)\b/i.test(text);
}

function hasConclusion(text: string): boolean {
  return /\b(in conclusion|to summarize|overall|in summary|to sum up|finally|ultimately|in short|in brief|to conclude|in essence)\b/i.test(text);
}

function hasTechnicalDepth(text: string): boolean {
  return /\b(complexity|algorithm|implementation|architecture|performance|optimization|trade-?off|abstraction|interface|protocol|paradigm|recursion|iteration|inheritance|polymorphism|encapsulation|asynchronous|concurrent|thread|pointer|reference|memory|stack|heap|cache|latency|throughput|scalab)\b/i.test(text);
}

/**
 * Stem-aware keyword coverage. Extracts significant words from the problem
 * and checks if the answer contains them (with fuzzy stem matching).
 */
function hasKeyTerms(text: string, problemText: string): number {
  const stopWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
    "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
    "she", "too", "use", "what", "when", "with", "have", "this", "will",
    "your", "from", "they", "been", "said", "each", "make", "like", "than",
    "that", "them", "then", "these", "some", "would", "could", "about",
    "other", "which", "their", "there", "should", "write", "problem",
    "practice", "answer", "explain", "between", "into", "also", "just",
    "more", "most", "very", "any", "both", "few", "own", "same", "so",
    "do", "if", "or", "an", "in", "to", "of", "is", "it", "at", "by",
    "on", "as", "be", "no", "up",
  ]);
  const problemWords = problemText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const textLower = text.toLowerCase();
  let found = 0;
  for (const w of problemWords) {
    // Check exact match OR stem match (word appears with common suffixes)
    const stem = w.length > 5 ? w.slice(0, w.length - 2) : w;
    if (textLower.includes(w) || textLower.includes(stem)) found++;
  }
  return problemWords.length > 0 ? found / problemWords.length : 0;
}

// ── Scoring engine ────────────────────────────────────────────────────

function evaluateStructure(answer: string, problemText: string): EvalResult {
  const wc = wordCount(answer);
  const sc = sentenceCount(answer);
  const pc = paragraphCount(answer);
  const examples = hasExamples(answer);
  const reasoning = hasReasoning(answer);
  const structured = hasStructure(answer);
  const definition = hasDefinition(answer);
  const comparison = hasComparison(answer);
  const conclusion = hasConclusion(answer);
  const technical = hasTechnicalDepth(answer);
  const termCoverage = hasKeyTerms(answer, problemText);

  // ── Completeness (0-100): generous curve for length ──
  // 0 words = 0, 10 words = 25, 30 words = 55, 60+ words = 80-100
  const completeness = wc === 0
    ? 0
    : wc <= 10
      ? wc * 2.5
      : wc <= 30
        ? 25 + (wc - 10) * 1.5
        : wc <= 60
          ? 55 + (wc - 30) * 0.8
          : Math.min(100, 80 + (wc - 60) * 0.15);

  // ── Relevance (0-100): key term coverage ──
  const relevance = Math.min(100, termCoverage * 110); // slight boost for high coverage

  // ── Depth (0-100): accumulation of quality signals ──
  // Each signal adds points; partial credit for some
  const depthSignals = [
    { hit: definition, pts: 15 },
    { hit: examples, pts: 20 },
    { hit: reasoning, pts: 25 },
    { hit: structured, pts: 15 },
    { hit: comparison, pts: 10 },
    { hit: conclusion, pts: 8 },
    { hit: technical, pts: 7 },
  ];
  const depth = Math.min(100, depthSignals.reduce((sum, s) => sum + (s.hit ? s.pts : 0), 0));

  // ── Presentation (0-100): readability and form ──
  const sentenceScore = Math.min(40, sc >= 8 ? 40 : sc >= 5 ? 30 : sc >= 3 ? 20 : sc * 5);
  const paragraphScore = Math.min(30, pc >= 4 ? 30 : pc >= 2 ? 15 : pc * 5);
  const wordScore = wc > 100 ? 30 : wc > 50 ? 25 : wc > 30 ? 15 : wc > 10 ? 8 : 0;
  const presentation = Math.min(100, sentenceScore + paragraphScore + wordScore);

  // ── Weighted total ──
  const score = Math.round(
    completeness * 0.20 +
    relevance * 0.25 +
    depth * 0.35 +
    presentation * 0.20,
  );

  // ── Strengths ──
  const strengths: string[] = [];
  if (wc >= 80) strengths.push("Excellent depth — your answer is thorough and comprehensive");
  else if (wc >= 40) strengths.push("Good level of detail — you provided substantial content");
  else if (wc >= 15) strengths.push("Concise and to the point");
  if (definition) strengths.push("Clear definitions demonstrate foundational understanding");
  if (examples) strengths.push("Concrete examples illustrate your understanding effectively");
  if (reasoning) strengths.push("Strong reasoning — you explained WHY, not just WHAT");
  if (structured) strengths.push("Well-organized response with clear structure");
  if (comparison) strengths.push("Demonstrates depth by comparing or contrasting concepts");
  if (technical) strengths.push("Uses appropriate technical terminology");
  if (conclusion) strengths.push("Includes a clear summary that ties everything together");
  if (termCoverage > 0.6) strengths.push(`Strong coverage of key concepts (${Math.round(termCoverage * 100)}% of problem vocabulary used)`);
  if (strengths.length === 0) strengths.push("You attempted the problem — starting is the hardest part");

  // ── Weaknesses ──
  const weaknesses: string[] = [];
  if (wc < 5) weaknesses.push("No meaningful content provided — try writing even a brief response");
  else if (wc < 15) weaknesses.push("Answer is brief — expand with more detail and explanation");
  if (!definition && wc > 10) weaknesses.push("Consider defining key terms to show foundational understanding");
  if (!examples && wc > 15) weaknesses.push("Add concrete examples to illustrate your points");
  if (!reasoning && wc > 20) weaknesses.push("Include reasoning — explain WHY things work, not just WHAT they are");
  if (!structured && wc > 20) weaknesses.push("Organize with numbered steps, paragraphs, or bullet points");
  if (termCoverage < 0.3 && wc > 10) weaknesses.push("Incorporate more of the key concepts from the problem");
  if (!conclusion && wc > 30) weaknesses.push("Add a brief summary to tie your answer together");
  if (!comparison && wc > 30 && /compar|differ|contrast|versus/i.test(problemText)) weaknesses.push("The question asks for comparison — explicitly contrast the concepts");

  // ── Build explanation ──
  const explanation = buildExplanation(problemText, answer, score, strengths, weaknesses);
  const improvedAnswer = buildModelAnswer(problemText);
  const equations = extractEquations(problemText);
  const diagram = generateConceptDiagram(problemText);

  return {
    score: Math.min(100, Math.max(0, score)),
    summary: score >= 80
      ? "Excellent answer with strong depth, structure, and reasoning."
      : score >= 65
        ? "Solid answer — shows good understanding with room to deepen."
        : score >= 45
          ? "Decent attempt — expand with examples, reasoning, and clearer structure."
          : score >= 25
            ? "Shows some understanding — needs more detail and concrete examples."
            : "Brief response — take time to explain key concepts thoroughly.",
    strengths,
    weaknesses,
    improvedAnswer,
    explanation,
    diagram,
    equations,
  };
}

// ── Explanation generator ──────────────────────────────────────────────

function buildExplanation(
  problem: string,
  answer: string,
  score: number,
  strengths: string[],
  weaknesses: string[],
): string {
  const wc = wordCount(answer);
  const topic = problem.slice(0, 120).replace(/^(Write|Explain|Describe|Discuss|Analyze|Compare|What|How|Why|Practice|Solve|Build|Design|Implement|Create|List|Draw|Compose|Set up|Write a)\s+/i, "").trim();

  let explanation = `## Understanding the Problem\n\n`;
  explanation += `This question asks you to demonstrate your understanding of: **${topic}**\n\n`;

  if (score >= 70) {
    explanation += `Your answer shows solid comprehension. Here's how to push it further.\n\n`;
  } else if (score >= 45) {
    explanation += `Your answer shows developing understanding, but there's room to demonstrate deeper knowledge. Let's explore what a stronger answer looks like.\n\n`;
  } else if (score >= 20) {
    explanation += `This is a challenging topic. Your attempt is a good first step — let's break down what a strong answer should cover.\n\n`;
  } else {
    explanation += `This is a challenging topic that requires detailed engagement. Let's walk through what a comprehensive answer looks like.\n\n`;
  }

  explanation += `## What a Strong Answer Addresses\n\n`;
  explanation += `1. **Core concept** — Define or explain the fundamental idea clearly\n`;
  explanation += `2. **Why it matters** — Connect the concept to its purpose or real-world relevance\n`;
  explanation += `3. **How it works** — Explain the mechanism, process, or reasoning\n`;
  explanation += `4. **Concrete examples** — Illustrate with specific, practical cases\n`;
  explanation += `5. **Connections** — Relate it to related concepts or show deeper understanding\n\n`;

  if (strengths.length > 0) {
    explanation += `## What You Did Well\n\n`;
    for (const s of strengths) {
      explanation += `- ${s}\n`;
    }
    explanation += `\n`;
  }

  if (weaknesses.length > 0) {
    explanation += `## Areas for Improvement\n\n`;
    for (const w of weaknesses) {
      explanation += `- ${w}\n`;
    }
    explanation += `\n`;
  }

  explanation += `## Key Takeaway\n\n`;
  explanation += `The difference between a basic and an excellent answer is **depth of explanation** and **concrete examples**. `;
  explanation += `Don't just state facts — explain the reasoning behind them and show you understand WHY they matter, not just WHAT they are.`;

  return explanation;
}

// ── Model answer generator ─────────────────────────────────────────────

function buildModelAnswer(problem: string): string {
  const topic = problem
    .replace(/^(Write|Explain|Describe|Discuss|Analyze|Compare|What|How|Why|Practice|Solve|Build|Design|Implement|Create|List|Draw|Compose|Set up|Write a)\s+/i, "")
    .replace(/\s*—.*$/, "")
    .replace(/\s*:.*$/, "")
    .trim()
    .slice(0, 80);

  return `**A model answer for this problem would include:**\n\n` +
    `1. **Clear definition** — Start by defining what "${topic}" is in your own words, establishing foundational understanding.\n\n` +
    `2. **Key principles** — Explain the 2-3 most important aspects or principles that make this concept work.\n\n` +
    `3. **Practical examples** — Provide at least 2 concrete, specific examples that demonstrate the concept in action. Examples should be varied (different scenarios) and detailed enough to show genuine understanding.\n\n` +
    `4. **Common pitfalls** — Mention what learners typically get wrong or misunderstand about this topic.\n\n` +
    `5. **Broader context** — Briefly connect this concept to related ideas or show where it leads next in your learning journey.\n\n` +
    `*This is a template — the best answers add domain-specific details, personal observations, and creative applications that show deep engagement with the material.*`;
}

// ── Equation extractor ─────────────────────────────────────────────────

function extractEquations(problem: string): string[] | undefined {
  const equations: string[] = [];

  const mathIndicators = /\b(equation|formula|calculate|compute|solve|integral|derivative|matrix|vector|proof|theorem|function|graph|plot|probability|statistics|algebra|calculus|linear|optimize|minimize|maximize|transform|series|integral|differential|laplace|fourier)\b/i;

  if (!mathIndicators.test(problem)) return undefined;

  const latexMatches = problem.match(/\$[^$]+\$/g);
  if (latexMatches) equations.push(...latexMatches);

  const topic = problem.toLowerCase();
  if (/\b(equation|solve|differential|ode|pde)\b/.test(topic)) {
    equations.push("General form: $ax^2 + bx + c = 0$");
    equations.push("Solution: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$");
  }
  if (/\b(proof|induction|theorem)\b/.test(topic)) {
    equations.push("Base case + inductive step: $P(k) \\implies P(k+1)$");
  }
  if (/\b(probability|statistic|distribution)\b/.test(topic)) {
    equations.push("Probability: $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$");
    equations.push("Conditional: $P(A|B) = \\frac{P(A \\cap B)}{P(B)}$");
  }
  if (/\b(transform|fourier|laplace)\b/.test(topic)) {
    equations.push("Fourier Transform: $F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-j\\omega t} dt$");
    equations.push("Laplace Transform: $F(s) = \\int_0^{\\infty} f(t) e^{-st} dt$");
  }

  return equations.length > 0 ? equations : undefined;
}

// ── Diagram generator ──────────────────────────────────────────────────

function generateConceptDiagram(problem: string): string | undefined {
  const topic = problem.toLowerCase();

  if (/\b(flow|process|algorithm|step|workflow|pipeline)\b/.test(topic)) {
    return `flowchart TD
    A[Start] --> B[Understand the Problem]
    B --> C[Identify Key Concepts]
    C --> D[Apply Principles]
    D --> E[Verify Solution]
    E --> F[Refine & Document]`;
  }

  if (/\b(hierarchy|tree|structure|classification|taxonomy|inheritance)\b/.test(topic)) {
    return `graph TD
    A[Root Concept] --> B[Sub-concept 1]
    A --> C[Sub-concept 2]
    B --> D[Detail 1]
    B --> E[Detail 2]
    C --> F[Detail 3]
    C --> G[Detail 4]`;
  }

  if (/\b(relationship|connect|compare|contrast|versus|difference)\b/.test(topic)) {
    return `graph LR
    A[Concept A] ---|shared| B[Concept B]
    A ---|unique trait 1| C[Aspect 1]
    B ---|unique trait 2| D[Aspect 2]
    C --- E[Outcome]
    D --- E`;
  }

  if (/\b(cycle|loop|iteration|recursive|feedback)\b/.test(topic)) {
    return `graph TD
    A[Input] --> B[Process]
    B --> C[Evaluate]
    C -->|Need more| B
    C -->|Complete| D[Output]`;
  }

  return `graph TD
    A[${topic.slice(0, 30)}] --> B[Core Principles]
    A --> C[Key Applications]
    A --> D[Related Concepts]
    B --> E[Fundamentals]
    B --> F[Advanced Theory]
    C --> G[Real-world Use Cases]
    C --> H[Best Practices]`;
}

// ── Main export ────────────────────────────────────────────────────────

/**
 * Evaluate an answer offline — guaranteed to return a valid result.
 * This is the always-works fallback that ensures no user ever sees
 * "evaluation unavailable."
 */
export function evaluateOffline(
  problemText: string,
  userAnswer: string,
): EvalResult {
  if (!userAnswer.trim()) {
    return {
      score: 0,
      summary: "No answer provided — the problem awaits your attempt.",
      strengths: [],
      weaknesses: [
        "You haven't submitted an answer yet",
        "Try writing even a brief response — attempting the problem is the first step to understanding",
        "Start with what you know, then build from there",
      ],
      explanation: `## Getting Started\n\nThis problem is asking you to engage with the material actively. Even a short attempt is valuable because:\n\n1. **Writing forces clarity** — you discover what you know and what you don't\n2. **Mistakes are data** — they show exactly where to focus your study\n3. **The evaluation will guide you** — it highlights strengths and specific improvements\n\nDon't aim for perfection on the first try. Aim for **honest engagement** with the problem.`,
      improvedAnswer: buildModelAnswer(problemText),
    };
  }

  return evaluateStructure(userAnswer, problemText);
}
