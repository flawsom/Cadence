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
  return /\b(because|therefore|thus|hence|since|this means|the reason|as a result|consequently|this shows|this demonstrates|in order to|so that|this is because|the key reason|the purpose|this ensures|this allows|this enables|which means|which allows|which ensures|allowing|enabling|ensuring|providing|rather than|instead of|compared to|which is why|this is why|making it|so it|to avoid|to prevent|to handle|to support|to enforce|to implement|to provide|to enable|to ensure|used to|which underpins|which underlie)\b/i.test(text);
}

function hasStructure(text: string): boolean {
  return /\n\s*[\d•·\-]\s*[.)]/m.test(text) || paragraphCount(text) >= 2;
}

function hasDefinition(text: string): boolean {
  return /\b(is defined as|refers to|means|can be described as|is a |is the |is known as|essentially|fundamentally|basically|in essence|by definition|is called|are called|known as|termed|defined|describes|describes how|describes the|which is|used to|used for|allows|enables|provides|offers|supports|implements|underpins|enforces|controls|generates|auto-generates)\b/i.test(text);
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

  // ── Completeness (0-100): curve rewards length AND multi-paragraph structure ──
  // Single paragraphs are capped lower; multi-paragraph answers earn more.
  const lengthScore = wc === 0
    ? 0
    : wc <= 10
      ? wc * 2.5
      : wc <= 30
        ? 25 + (wc - 10) * 1.0
        : wc <= 60
          ? 45 + (wc - 30) * 0.6
          : wc <= 100
            ? 63 + (wc - 60) * 0.3
            : Math.min(100, 75 + (wc - 100) * 0.1);
  const structureMultiplier = pc >= 4 ? 1.15 : pc >= 2 ? 1.05 : pc === 1 ? 0.85 : 1.0;
  const completeness = Math.min(100, Math.round(lengthScore * structureMultiplier));

  // ── Relevance (0-100): key term coverage + technical vocabulary bonus ──
  const termScore = Math.min(100, termCoverage * 110);
  const techBonus = technical ? 15 : 0; // bonus for domain-specific vocabulary
  const relevance = Math.min(100, termScore + techBonus);

  // ── Depth (0-100): accumulation of quality signals ──
  // Technical depth is weighted heavily — expert answers use domain vocabulary
  const depthSignals = [
    { hit: definition, pts: 12 },
    { hit: examples, pts: 18 },
    { hit: reasoning, pts: 22 },
    { hit: structured, pts: 10 },
    { hit: comparison, pts: 8 },
    { hit: conclusion, pts: 5 },
    { hit: technical, pts: 25 }, // heavily rewarded — expert answers use technical terms
  ];
  const depth = Math.min(100, depthSignals.reduce((sum, s) => sum + (s.hit ? s.pts : 0), 0));

  // ── Presentation (0-100): strongly rewards multi-paragraph structure ──
  // Single paragraphs cap at ~55; multi-paragraph answers earn much more.
  const sentenceScore = Math.min(25, sc >= 8 ? 25 : sc >= 5 ? 18 : sc >= 3 ? 12 : sc * 3);
  const paragraphScore = pc >= 5 ? 40 : pc >= 3 ? 30 : pc >= 2 ? 20 : 10; // single para = 10 max
  const wordScore = wc > 100 ? 35 : wc > 60 ? 25 : wc > 30 ? 15 : wc > 10 ? 5 : 0;
  const presentation = Math.min(100, sentenceScore + paragraphScore + wordScore);

  // ── Weighted total ──
  let score = Math.round(
    completeness * 0.20 +
    relevance * 0.20 +
    depth * 0.30 +
    presentation * 0.30,  // structure matters a lot: single paragraph vs multi-part essay
  );

  // ── Expert bonus: genuinely deep answers with multiple quality signals ──
  // Only triggers for multi-paragraph, deeply structured expert essays
  // Requires: 80+ words, technical vocabulary, AND at least one advanced signal (comparison or conclusion)
  const advancedSignals = [comparison, conclusion].filter(Boolean).length;
  if (wc >= 80 && technical && advancedSignals >= 1 && (reasoning || examples)) {
    score = Math.min(100, score + 10);
  }

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
  const t = problem.toLowerCase();

  // ── Programming / CS ──────────────────────────────────────
  if (/\b(linked list|node|pointer|next|prev)\b/.test(t)) {
    return `graph LR\n    N1[Node A|data] -->|next| N2[Node B|data]\n    N2 -->|next| N3[Node C|data]\n    N3 -->|null| NULL((nil))\n    N1 -.->|prev| N0((head))\n    style N1 fill:#f96,stroke:#333\n    style N2 fill:#f96,stroke:#333\n    style N3 fill:#f96,stroke:#333`;
  }
  if (/\b(array|vector|list|index|element|subscript)\b/.test(t)) {
    return `graph LR\n    A["arr[0]"] --- B["arr[1]"] --- C["arr[2]"] --- D["arr[3]"]\n    E["index"] -.-> A\n    style A fill:#9cf,stroke:#333\n    style B fill:#9cf,stroke:#333\n    style C fill:#9cf,stroke:#333\n    style D fill:#9cf,stroke:#333`;
  }
  if (/\b(stack|push|pop|lifo|top)\b/.test(t) && /\b(data structure|store|access|element)\b/.test(t)) {
    return `graph TD\n    PUSH[Push] --> TOP[Top]\n    TOP --> S1[Element 3]\n    S1 --> S2[Element 2]\n    S2 --> S3[Element 1]\n    TOP --> POP[Pop]\n    style TOP fill:#f96,stroke:#333\n    style S1 fill:#ff9,stroke:#333\n    style S2 fill:#ff9,stroke:#333\n    style S3 fill:#ff9,stroke:#333`;
  }
  if (/\b(queue|enqueue|dequeue|fifo|front|rear)\b/.test(t) && /\b(data|structure|store|element)\b/.test(t)) {
    return `graph LR\n    ENQ[Enqueue] --> F[Front]\n    F --> Q1[Item 1]\n    Q1 --> Q2[Item 2]\n    Q2 --> Q3[Item 3]\n    Q3 --> R[Rear]\n    R --> DEQ[Dequeue]\n    style F fill:#9cf,stroke:#333\n    style R fill:#f96,stroke:#333`;
  }
  if (/\b(tree|binary|bst|node|child|parent|root|leaf|height|depth)\b/.test(t) && /\b(data|structure|algorithm|traversal)\b/.test(t)) {
    return `graph TD\n    R[Root] --> L[Left Child]\n    R --> RI[Right Child]\n    L --> LL[Leaf]\n    L --> LR[Leaf]\n    RI --> RL[Leaf]\n    RI --> RR[Leaf]\n    style R fill:#f96,stroke:#333\n    style LL fill:#9f9,stroke:#333\n    style LR fill:#9f9,stroke:#333\n    style RL fill:#9f9,stroke:#333\n    style RR fill:#9f9,stroke:#333`;
  }
  if (/\b(hash|hashing|bucket|collision|key.?value|dictionary|map)\b/.test(t)) {
    return `graph LR\n    KEY[Key] --> HASH[Hash Function]\n    HASH --> B0[Bucket 0]\n    HASH --> B1[Bucket 1]\n    HASH --> B2[Bucket 2]\n    B0 --> V0[Value]\n    B1 --> V1[Value]\n    B2 --> V2[Value]\n    style HASH fill:#f96,stroke:#333`;
  }
  if (/\b(class|object|instance|method|inheritance|polymorphism|encapsulation|interface|abstract|override|overload)\b/.test(t)) {
    return `classDiagram\n    class Animal {\n        +String name\n        +speak()\n    }\n    class Dog {\n        +fetch()\n    }\n    class Cat {\n        +purr()\n    }\n    Animal <|-- Dog\n    Animal <|-- Cat\n    style Animal fill:#f96,stroke:#333\n    style Dog fill:#9cf,stroke:#333\n    style Cat fill:#9f9,stroke:#333`;
  }
  if (/\b(recursion|recursive|base case|divide|conquer|merge)\b/.test(t)) {
    return `flowchart TD\n    F[fact 5] -->|calls| F4[fact 4]\n    F4 -->|calls| F3[fact 3]\n    F3 -->|calls| F2[fact 2]\n    F2 -->|calls| F1[fact 1]\n    F1 --> BASE[Base Case: returns 1]\n    F2 --> R2[returns 2]\n    F3 --> R3[returns 6]\n    F4 --> R4[returns 24]\n    F --> R5[returns 120]\n    style BASE fill:#f96,stroke:#333`;
  }
  if (/\b(sort|bubble|merge|quick|heap|insertion|selection|comparison)\b/.test(t)) {
    return `flowchart TD\n    A[Unsorted Array] --> B{Choose Pivot}\n    B -->|less than| C[Left Partition]\n    B -->|greater than| D[Right Partition]\n    C --> E[Recurse Left]\n    D --> F[Recurse Right]\n    E --> G[Merge/Combine]\n    F --> G\n    G --> H[Sorted Array]\n    style A fill:#f99,stroke:#333\n    style H fill:#9f9,stroke:#333`;
  }
  if (/\b(api|endpoint|rest|http|request|response|status code|method|url|json)\b/.test(t)) {
    return `sequenceDiagram\n    participant C as Client\n    participant S as Server\n    participant D as Database\n    C->>S: GET /api/resource\n    S->>D: SELECT * FROM table\n    D-->>S: Result set\n    S-->>C: 200 OK (JSON)\n    C->>S: POST /api/resource\n    S->>D: INSERT INTO table\n    D-->>S: Confirmation\n    S-->>C: 201 Created`;
  }
  if (/\b(algorithm|complexity|time|space|big.?o|asymptotic|efficiency)\b/.test(t)) {
    return `graph LR\n    O1["O(1)"] --> OLG["O(log n)"] --> ON["O(n)"] --> ONLOGN["O(n log n)"] --> ON2["O(n²)"] --> O2N["O(2ⁿ)"]\n    style O1 fill:#9f9,stroke:#333\n    style OLG fill:#9f9,stroke:#333\n    style ON fill:#ff9,stroke:#333\n    style ONLOGN fill:#ff9,stroke:#333\n    style ON2 fill:#f99,stroke:#333\n    style O2N fill:#f66,stroke:#333`;
  }
  if (/\b(database|sql|query|table|column|row|join|index|normali)\b/.test(t)) {
    return `erDiagram\n    USER ||--o{ ORDER : places\n    ORDER ||--|{ ORDER_ITEM : contains\n    PRODUCT ||--o{ ORDER_ITEM : "is in"\n    USER {\n        int id PK\n        string name\n    }\n    ORDER {\n        int id PK\n        date created\n    }`;
  }
  if (/\b(tcp|udp|packet|socket|port|dns|osi)\b/.test(t)) {
    if (/\b(tcp|udp)\b/.test(t)) {
      return `graph TD\n    TCP[TCP] --> RELIABLE[Reliable Delivery]\n    TCP --> ORDERED[Ordered Packets]\n    TCP --> CONN[Connection-Oriented]\n    TCP --> FLOW[Flow Control]\n    UDP[UDP] --> FAST[Fast / Low Overhead]\n    UDP --> UNORDERED[No Order Guarantee]\n    UDP --> NO_CONN[Connectionless]\n    UDP --> BROADCAST[Broadcast Support]\n    TCP -.->|best for: web, email, file transfer| USE1[HTTP, SMTP, FTP]\n    UDP -.->|best for: gaming, streaming, DNS| USE2[VoIP, DNS, Video]\n    style TCP fill:#9cf,stroke:#333\n    style UDP fill:#f96,stroke:#333`;
    }
    return `graph TD\n    APP[Application Layer] --> TRAN[Transport Layer]\n    TRAN --> NET[Network Layer]\n    NET --> LINK[Data Link Layer]\n    LINK --> PHY[Physical Layer]\n    PHY -.->|signals| REMOTE((Remote))\n    style APP fill:#9cf,stroke:#333\n    style TRAN fill:#9f9,stroke:#333\n    style NET fill:#ff9,stroke:#333\n    style LINK fill:#f96,stroke:#333\n    style PHY fill:#f99,stroke:#333`;
  }
  if (/\b(cloud|aws|azure|gcp|serverless|lambda|instance|container|docker|kubernetes|s3|ec2)\b/.test(t)) {
    return `graph TD\n    USER[User] --> CDN[CDN/Edge]\n    CDN --> APIGW[API Gateway]\n    APIGW --> LAMBDA[Serverless Function]\n    LAMBDA --> DB[(Database)]\n    LAMBDA --> S3[Object Storage]\n    LAMBDA --> Q[Message Queue]\n    Q --> WORKER[Background Worker]\n    WORKER --> DB\n    style LAMBDA fill:#f96,stroke:#333`;
  }
  if (/\b(security|encryption|hash|certificate|ssl|tls|authentication|authorization|token|jwt)\b/.test(t)) {
    return `sequenceDiagram\n    participant C as Client\n    participant S as Server\n    participant CA as Auth Provider\n    C->>S: Login Request\n    S->>CA: Verify Credentials\n    CA-->>S: JWT Token\n    S-->>C: Token + Refresh Token\n    C->>S: API Request + Bearer Token\n    S->>S: Verify JWT\n    S-->>C: 200 OK (Protected Data)`;
  }
  if (/\b(concurrency|thread|mutex|lock|deadlock|race condition|synchron|parallel|atomic)\b/.test(t)) {
    return `sequenceDiagram\n    participant T1 as Thread 1\n    participant L as Lock/Mutex\n    participant T2 as Thread 2\n    T1->>L: Acquire Lock\n    L-->>T1: Granted\n    T1->>T1: Critical Section\n    T2->>L: Acquire Lock\n    L-->>T2: Blocked\n    T1->>L: Release Lock\n    L-->>T2: Granted\n    T2->>T2: Critical Section\n    T2->>L: Release Lock`;
  }
  if (/\b(regular expression|regex|pattern|match|capture|group)\b/.test(t)) {
    return `graph LR\n    INPUT[Input String] --> REGEX[Regex Pattern]\n    REGEX -->|match| MATCH[Match Found]\n    REGEX -->|no match| NO_MATCH[No Match]\n    REGEX -->|group 1| G1[Captured Group 1]\n    REGEX -->|group 2| G2[Captured Group 2]\n    style MATCH fill:#9f9,stroke:#333\n    style NO_MATCH fill:#f99,stroke:#333`;
  }
  if (/\b(design pattern|singleton|factory|observer|strategy|decorator|adapter|proxy|builder|command|state)\b/.test(t)) {
    return `classDiagram\n    class Context {\n        -Strategy strategy\n        +setStrategy(Strategy)\n        +executeStrategy()\n    }\n    class Strategy {\n        <<interface>>\n        +execute()\n    }\n    class ConcreteA {\n        +execute()\n    }\n    class ConcreteB {\n        +execute()\n    }\n    Context o-- Strategy\n    Strategy <|.. ConcreteA\n    Strategy <|.. ConcreteB`;
  }

  // ── Math ───────────────────────────────────────────────────
  if (/\b(probability|probability distribution|bayes|conditional|independent|sample space)\b/.test(t)) {
    return `graph TD\n    S[Sample Space] --> E1[Event A]\n    S --> E2[Event B]\n    E1 -->|A AND B| BOTH[Intersection]\n    E2 --> BOTH\n    E1 -->|A OR B| UNION[Union]\n    E2 --> UNION\n    BOTH --> P["P(A∩B) = P(A)·P(B) if independent"]\n    UNION --> PU["P(A∪B) = P(A) + P(B) - P(A∩B)"]\n    style BOTH fill:#f96,stroke:#333\n    style UNION fill:#9cf,stroke:#333`;
  }
  if (/\b(statistics|mean|median|mode|variance|standard deviation|regression|correlation|confidence interval)\b/.test(t)) {
    return `graph TD\n    DATA[Raw Data] --> DESC[Descriptive Stats]\n    DATA --> INFER[Inferential Stats]\n    DESC --> M[Mean / Median / Mode]\n    DESC --> V[Variance / Std Dev]\n    DESC --> R[Range / IQR]\n    INFER --> CI[Confidence Intervals]\n    INFER --> HT[Hypothesis Testing]\n    INFER --> RE[Regression Analysis]\n    style DATA fill:#ff9,stroke:#333`;
  }
  if (/\b(integral|integration|definite|indefinite|antiderivative|area under|riemann)\b/.test(t)) {
    return `graph LR\n    F["f(x)"] -->|integrate| G["F(x) + C"]\n    G -->|evaluate| AREA["Area under curve"]\n    AREA --> DEF["∫ₐᵇ f(x)dx = F(b) - F(a)"]\n    style F fill:#9cf,stroke:#333\n    style DEF fill:#f96,stroke:#333`;
  }
  if (/\b(derivative|differentiation|chain rule|product rule|slope|rate of change|tangent)\b/.test(t)) {
    return `graph LR\n    F["f(x)"] -->|differentiate| FP["f'(x)"]\n    FP --> SLOPE[Slope at point]\n    FP --> RATE[Rate of change]\n    FP --> TAN[Tangent line]\n    CHAIN[Chain Rule:\n"(f∘g)' = f'(g)·g'"] -.-> FP\n    style FP fill:#f96,stroke:#333`;
  }
  if (/\b(matrix|matrices|determinant|eigenvalue|eigenvector|transpose|inverse|linear transformation)\b/.test(t)) {
    return `graph LR\n    A[Matrix A] --> DET[Determinant]\n    A --> INV[Inverse A⁻¹]\n    A --> EIG[Eigenvalues]\n    DET -->|det≠0| CAN_INV[Invertible]\n    DET -->|det=0| SING[Singular]\n    EIG --> DECOMPOSE[Diagonalization]\n    style A fill:#9cf,stroke:#333\n    style DET fill:#ff9,stroke:#333`;
  }
  if (/\b(laplace|fourier|transform|frequency|domain|signal|spectrum)\b/.test(t)) {
    return `graph LR\n    TIME[Time Domain f t] -->|Transform| FREQ[Frequency Domain F omega]\n    FREQ -->|Inverse Transform| TIME\n    TIME --> SIGNAL[Continuous Signal]\n    FREQ --> SPECT[Frequency Spectrum]\n    style TIME fill:#9cf,stroke:#333\n    style FREQ fill:#f96,stroke:#333`;
  }
  if (/\b(equation|solve|quadratic|polynomial|linear system|cramer)\b/.test(t)) {
    return `flowchart TD\n    PROB[Problem] --> TYPE{Type?}\n    TYPE -->|Linear| LIN["ax + b = 0"]\n    TYPE -->|Quadratic| QUAD["ax² + bx + c = 0"]\n    TYPE -->|System| SYS[Matrix form AX=B]\n    LIN --> SOL1["x = -b/a"]\n    QUAD --> SOL2["x = (-b ± √(b²-4ac)) / 2a"]\n    SYS --> SOL3["X = A⁻¹B"]\n    style SOL1 fill:#9f9,stroke:#333\n    style SOL2 fill:#f96,stroke:#333\n    style SOL3 fill:#9cf,stroke:#333`;
  }

  // ── Science / Engineering ──────────────────────────────────
  if (/\b(physics|force|mass|acceleration|energy|momentum|velocity|gravity|newton)\b/.test(t)) {
    return `graph TD\n    F[Force F] -->|F=ma| A[Acceleration]\n    M[Mass m] --> F\n    A --> V[Velocity]\n    V -->|integrate| X[Displacement]\n    KE["KE = ½mv²"] -.-> ENERGY[Energy]\n    PE["PE = mgh"] -.-> ENERGY\n    style F fill:#f96,stroke:#333\n    style ENERGY fill:#9f9,stroke:#333`;
  }
  if (/\b(chemistry|bond|reaction|molecule|atom|element|compound|organic|inorganic)\b/.test(t)) {
    return `graph TD\n    A[Atom] -->|covalent bond| M[Molecule]\n    A -->|ionic bond| ION[Ionic Compound]\n    A -->|metallic bond| MET[Metallic Structure]\n    M --> COMP1[Compound A]\n    M --> COMP2[Compound B]\n    COMP1 -->|reacts with| PROD[Products]\n    COMP2 --> PROD\n    style A fill:#f96,stroke:#333\n    style PROD fill:#9f9,stroke:#333`;
  }
  if (/\b(biology|cell|dna|rna|protein|gene|nucleus|mitosis|meiosis|evolution)\b/.test(t)) {
    return `graph TD\n    DNA[DNA] -->|transcription| RNA[mRNA]\n    RNA -->|translation| PROTEIN[Protein]\n    PROTEIN --> FUNCTION[Cell Function]\n    DNA -->|replication| DNA2[Copy DNA]\n    DNA --> MUTATION[Mutation]\n    MUTATION -->|natural selection| EVOLUTION[Evolution]\n    style DNA fill:#9cf,stroke:#333\n    style PROTEIN fill:#9f9,stroke:#333`;
  }
  if (/\b(circuit|resistor|capacitor|voltage|current|ohm|kirchhoff|ac|dc|transistor|diode)\b/.test(t)) {
    return `graph TD\n    V[Voltage Source] --> R[Resistor]\n    R --> C[Capacitor]\n    C --> GND[Ground]\n    V --> I["I = V/R (Ohm's Law)"]\n    R --> POWER["P = IV = I²R"]\n    style V fill:#ff9,stroke:#333\n    style I fill:#f96,stroke:#333`;
  }

  // ── Image Processing / Signal Processing ───────────────────
  if (/\b(image|pixel|filter|convolution|kernel|blur|sharpen|edge detection|noise|histogram)\b/.test(t)) {
    return `graph LR\n    IMG[Original Image] --> PREPROC[Preprocessing]\n    PREPROC --> ENHANCE[Enhancement]\n    ENHANCE --> FEATURE[Feature Extraction]\n    FEATURE --> SEGMENT[Segmentation]\n    SEGMENT --> CLASS[Classification]\n    FILTER[Convolution Kernel] -.-> ENHANCE\n    style IMG fill:#9cf,stroke:#333\n    style FILTER fill:#ff9,stroke:#333`;
  }

  // ── Language Learning ──────────────────────────────────────
  if (/\b(grammar|syntax|tense|verb|noun|adjective|conjugat|declension|sentence structure)\b/.test(t)) {
    return `graph TD\n    S[Sentence] --> NP[Noun Phrase]\n    S --> VP[Verb Phrase]\n    NP --> DET[Determiner]\n    NP --> N[Noun]\n    VP --> V[Verb]\n    VP --> OBJ[Object]\n    VP --> ADV[Adverb]\n    style S fill:#f96,stroke:#333`;
  }
  if (/\b(vocabulary|word|phrase|idiom|expression|meaning|definition)\b/.test(t)) {
    return `graph TD\n    WORD[New Word] --> DEF[Definition]\n    WORD --> EX[Example Sentence]\n    WORD --> SYN[Synonyms]\n    WORD --> ANT[Antonyms]\n    WORD --> CONTEXT[Usage Context]\n    CONTEXT --> FORMAL[Formal]\n    CONTEXT --> CASUAL[Casual]\n    style WORD fill:#f96,stroke:#333`;
  }
  if (/\b(listening|speaking|pronunciation|accent|fluency|conversation)\b/.test(t)) {
    return `graph TD\n    HEAR[Listen to Audio] --> REPEAT[Repeat / Shadow]\n    RECORD[Record Yourself] --> COMPARE[Compare with Source]\n    REPEAT --> COMPARE\n    COMPARE --> IDENTIFY[Identify Gaps]\n    IDENTIFY --> PRACTICE[Targeted Practice]\n    PRACTICE --> FLUENCY[Improved Fluency]\n    style HEAR fill:#9cf,stroke:#333\n    style FLUENCY fill:#9f9,stroke:#333`;
  }
  if (/\b(writing|essay|paragraph|thesis|argument|rhetoric|persuasion)\b/.test(t)) {
    return `flowchart TD\n    TOPIC[Choose Topic] --> THESIS[Write Thesis Statement]\n    THESIS --> OUTLINE[Create Outline]\n    OUTLINE --> INTRO[Introduction]\n    INTRO --> BODY[Body Paragraphs]\n    BODY --> EVIDENCE[Support with Evidence]\n    EVIDENCE --> CONCLUSION[Conclusion]\n    CONCLUSION --> REVISE[Revise & Edit]\n    style THESIS fill:#f96,stroke:#333\n    style REVISE fill:#9f9,stroke:#333`;
  }

  // ── Music ──────────────────────────────────────────────────
  if (/\b(scale|chord|interval|note|pitch|harmony|melody|rhythm|tempo|key|major|minor)\b/.test(t)) {
    return `graph TD\n    ROOT[Root Note] --> MAJOR[Major: W W H W W W H]\n    ROOT --> MINOR[Minor: W H W W H W W]\n    ROOT --> PENTA[Pentatonic: 5 notes]\n    MAJOR --> CHORD_T[Major Triad: 1 3 5]\n    MINOR --> CHORD_M[Minor Triad: 1 ♭3 5]\n    CHORD_T --> PROG[Chord Progression]\n    CHORD_M --> PROG\n    style ROOT fill:#f96,stroke:#333`;
  }

  // ── Generic concept map (fallback) ─────────────────────────
  const shortTopic = t.slice(0, 30);
  return `graph TD\n    A["${shortTopic}"] --> B[Core Principles]\n    A --> C[Key Applications]\n    A --> D[Related Concepts]\n    B --> E[Fundamentals]\n    B --> F[Advanced Theory]\n    C --> G[Real-world Examples]\n    C --> H[Best Practices]\n    D --> I[Prerequisites]\n    D --> J[Next Steps]`;
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
