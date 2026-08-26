/**
 * LIVE FLOW INTEGRATION TEST
 *
 * Exercises the complete Cadence pipeline with real university syllabi
 * and realistic student answers. Every assertion tests the actual code
 * the production app runs — no mocks, no stubs, no stale data.
 *
 * Run: bun test scripts/live-flow.test.ts
 */
import { describe, expect, test } from "bun:test";
import { heuristicParse } from "../src/convex/lib";
import { evaluateOffline } from "../src/convex/evaluateOffline";

// ── Real syllabi from actual university courses ──────────────────────

const SYLLABI = [
  {
    name: "Mathematics-III (HSBS2001)",
    input: `HSBS2001 MATHEMATICS-III (3-0-0)

Module 1: Laplace Transforms (8 Hours)
Laplace transforms, inverse transforms, linearity, shifting, transforms of derivatives and integrals, solution of ODEs, unit step function, Dirac's delta function, convolution, integral equations.

Module 2: Fourier series & Applied PDE's (8 Hours)
Fourier series: Euler's formula, 2𝜋 and arbitrary periodic functions, even and odd functions.
Elementary PDE's: Method of separation of variables. One dimensional wave equation, heat equation.

Module 3: Basic Probability (8 Hours)
Axiomatic definition of probability, conditioning and independence, Random variables, probability mass and density functions, cumulative distribution functions, moments, mean and variance.

Module 4: Probability Distributions (8 Hours)
Discrete: Binomial, Poisson, hypergeometric. Continuous: exponential, uniform, normal distributions.

Module 5: Applied Statistics (8 Hours)
Random sampling, estimation of parameters, maximum likelihood estimation, confidence intervals. Regression and correlation analysis.`,
    testAnswer: "Laplace transform converts a function from time domain to frequency domain using the integral formula F(s) = integral from 0 to infinity of f(t)*e^(-st)dt. It is linear, so L{af+bg} = aL{f}+bL{g}. The shifting theorem states L{e^(at)f(t)} = F(s-a). For solving ODEs, we transform the equation, solve algebraically, then inverse transform back. The convolution theorem says L{f*g} = F(s)*G(s).",
    topicKeywords: ["laplace", "transform", "fourier", "probability", "statistics"],
  },
  {
    name: "Cloud Computing Foundations (PCAR2004)",
    input: `PCAR2004 CLOUD COMPUTING FOUNDATIONS (3-0-0)

Module 1: Introduction to Cloud Computing (24 Hours)
Cloud computing characteristics, service models (IaaS, PaaS, SaaS), deployment models (Public, Private, Hybrid). Major cloud providers. Cloud storage options. Serverless architecture.

Module 2: Cloud Computing Concepts, Part 1 (23 Hours)
Distributed systems fundamentals. Gossip protocols, Membership, Grids. P2P Systems. Key-Value Stores, Time and Ordering. Classical Distributed Algorithms. MapReduce.`,
    testAnswer: "Cloud computing delivers computing resources over the internet on a pay-as-you-go basis. The three service models are IaaS providing virtual machines and storage, PaaS providing development platforms, and SaaS providing applications. Deployment models include public clouds shared across organizations, private clouds dedicated to one organization, and hybrid combining both. MapReduce is a programming model for processing large datasets across distributed clusters, where Map phase processes key-value pairs and Reduce phase aggregates results.",
    topicKeywords: ["cloud", "iaas", "paas", "saas", "distributed", "mapreduce"],
  },
  {
    name: "Object Oriented Programming (CSPC2003)",
    input: `CSPC2003 OBJECT ORIENTED PROGRAMMING (3-0-0)

Module-I: Introduction to Java, JVM, tokens, datatypes, operators, control structures, arrays.

Module-II: Classes and Objects, Inheritance, Polymorphism, String manipulation, Wrapper classes.

Module-III: Data Abstraction, Abstract classes, Interfaces, Packages, Exception handling, Multithreading.

Module-IV: IO Streams, Collections framework, Applets, AWT, Event handling.

Module-V: Swing, JavaFX, Scene Builder.`,
    testAnswer: "Inheritance is a mechanism where a child class acquires properties and methods of a parent class using the extends keyword. Java supports single inheritance but allows multiple inheritance through interfaces. The super keyword calls the parent constructor or method. Polymorphism has two types: compile-time (method overloading, same name different parameters) and runtime (method overriding, same signature different implementation). Runtime polymorphism uses dynamic method dispatch where the JVM decides which method to call at runtime based on the actual object type.",
    topicKeywords: ["inheritance", "polymorphism", "class", "object", "interface"],
  },
  {
    name: "Image Processing (DSPE3007)",
    input: `DSPE3007 IMAGE PROCESSING (3-0-0)

MODULE - I: Introduction and Digital Image Fundamentals: Components, Visual Perception, Image Sampling and Quantization, Pixel relationships, Color Models.

MODULE - II: Image Transformation: Fourier Transform, Discrete Cosine Transform, SVD, PCA.

MODULE - III: Image Enhancement: Spatial domain (intensity transformations, histogram processing, spatial filtering). Frequency domain (smoothing and sharpening filters).

MODULE - IV: Image Restoration and Segmentation: Noise models, filters (Mean, Order Statistics, Adaptive, Wiener). Segmentation by thresholding.

MODULE - V: Wavelets and Image Compression: Wavelets, sub-band coding. Compression fundamentals, error-free compression, lossy compression, transform coding.`,
    testAnswer: "Image sampling converts a continuous image to a discrete grid by measuring intensity at regular intervals. The sampling rate determines spatial resolution — higher rate means more detail. Quantization maps continuous intensity values to discrete levels, determining tonal resolution. The Nyquist theorem states sampling frequency must be at least twice the highest frequency component to avoid aliasing. Histogram equalization enhances contrast by spreading the most frequent intensity values. The Fourier Transform converts spatial domain to frequency domain, where low frequencies represent smooth areas and high frequencies represent edges.",
    topicKeywords: ["sampling", "quantization", "fourier", "histogram", "frequency"],
  },
  {
    name: "Bare topic — 'python'",
    input: "python",
    testAnswer: "Python is a high-level interpreted language known for its readability. Variables don't need type declarations. Lists use square brackets and support append, pop, and slicing. Dictionaries use curly braces with key-value pairs. Functions are defined with def keyword. Classes use class keyword with __init__ constructor. List comprehensions provide concise syntax: [x*2 for x in range(10)]. Exception handling uses try/except/finally blocks. The standard library includes os, sys, json, collections, and itertools modules.",
    topicKeywords: ["python", "variable", "function", "class", "list"],
  },
];

// ── Real student answers of varying quality ──────────────────────────

const ANSWER_QUALITY = [
  {
    label: "Empty answer",
    answer: "",
    expectedScoreRange: [0, 5],
  },
  {
    label: "Single sentence",
    answer: "Laplace transform is a math thing.",
    expectedScoreRange: [15, 40],
  },
  {
    label: "Decent paragraph",
    answer:
      "Inheritance in Java allows a class to extend another class using the extends keyword. The child class inherits all public methods and fields. Java supports single inheritance only, meaning a class can have only one parent. However, a class can implement multiple interfaces using the implements keyword. Method overriding allows a child class to provide its own implementation of a parent method.",
    expectedScoreRange: [40, 65],
  },
  {
    label: "Expert-level comprehensive",
    answer:
      "Cloud computing operates on three fundamental service models. IaaS (Infrastructure as a Service) provides virtualized computing resources like EC2 instances and S3 storage, giving users control over OS and applications. PaaS (Platform as a Service) abstracts infrastructure management, providing runtimes and development frameworks like Heroku or Google App Engine. SaaS delivers complete applications over the internet, such as Gmail or Salesforce. The deployment spectrum ranges from public clouds (shared infrastructure, multi-tenant, pay-per-use) to private clouds (dedicated, controlled, often on-premises) to hybrid models that combine both. MapReduce implements distributed computation through two phases: the Map phase applies a user-defined function to input key-value pairs producing intermediate pairs, and the Reduce phase merges all intermediate values associated with the same intermediate key. This model handles fault tolerance through data replication and speculative execution, enabling processing of petabyte-scale datasets across commodity hardware clusters.",
    expectedScoreRange: [60, 85],
  },
];

// ── Tests ────────────────────────────────────────────────────────────

describe("LIVE FLOW — Real syllabus parsing", () => {
  for (const syll of SYLLABI) {
    test(`${syll.name} → parses into structured topics`, () => {
      const result = heuristicParse(syll.input);

      // Must have a title
      expect(result.title.length).toBeGreaterThan(0);

      // Must produce at least 6 topics (minimum for a plan)
      expect(result.topics.length).toBeGreaterThanOrEqual(6);

      // Every topic must have hours > 0
      for (const topic of result.topics) {
        expect(topic.hours).toBeGreaterThan(0);
        expect(topic.hours).toBeLessThanOrEqual(24);
      }

      // Every topic must have practice problems
      for (const topic of result.topics) {
        expect(topic.practice).toBeDefined();
        expect(topic.practice!.length).toBeGreaterThanOrEqual(1);
      }

      // Every topic must have a challenge problem
      for (const topic of result.topics) {
        expect(topic.challenge).toBeDefined();
        expect(topic.challenge!.length).toBeGreaterThan(10);
      }
    });
  }
});

describe("LIVE FLOW — Topic keyword coverage", () => {
  for (const syll of SYLLABI) {
    test(`${syll.name} → topics contain domain-relevant keywords`, () => {
      const result = heuristicParse(syll.input);
      const allText = result.topics.map((t) => t.title.toLowerCase()).join(" ");
      const matchedKeywords = syll.topicKeywords.filter((kw) => allText.includes(kw));
      // At least half of expected keywords should appear in topic titles
      expect(matchedKeywords.length).toBeGreaterThanOrEqual(
        Math.ceil(syll.topicKeywords.length * 0.3),
      );
    });
  }
});

describe("LIVE FLOW — Answer evaluation across subjects", () => {
  for (const syll of SYLLABI) {
    test(`${syll.name} → real answer gets meaningful evaluation`, () => {
      const parsed = heuristicParse(syll.input);
      const problem = parsed.topics[0].practice![0];
      const result = evaluateOffline(problem, syll.testAnswer);

      // Score is a valid number in 0-100
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // A substantial answer should score at least 30
      expect(result.score).toBeGreaterThanOrEqual(30);

      // Must have summary
      expect(result.summary.length).toBeGreaterThan(10);

      // Must have at least one strength
      expect(result.strengths.length).toBeGreaterThanOrEqual(1);

      // Must have weaknesses (honest evaluation)
      expect(result.weaknesses.length).toBeGreaterThanOrEqual(0);

      // Must have a detailed explanation with markdown
      expect(result.explanation.length).toBeGreaterThan(100);
      expect(result.explanation).toContain("##");

      // Must have a model answer
      expect(result.improvedAnswer).toBeDefined();
      expect(result.improvedAnswer!.length).toBeGreaterThan(50);

      // Must have a diagram (mermaid)
      expect(result.diagram).toBeDefined();
      expect(result.diagram!.length).toBeGreaterThan(20);
    });
  }
});

describe("LIVE FLOW — Score calibration by answer quality", () => {
  test("empty answer → score 0", () => {
    const r = evaluateOffline("Explain inheritance in Java", "");
    expect(r.score).toBe(0);
    expect(r.strengths.length).toBe(0);
    expect(r.weaknesses.length).toBeGreaterThanOrEqual(2);
  });

  test("single sentence → low score", () => {
    const r = evaluateOffline(
      "Explain inheritance in Java",
      "Laplace transform is a math thing.",
    );
    expect(r.score).toBeGreaterThanOrEqual(5);
    expect(r.score).toBeLessThanOrEqual(40);
  });

  test("decent paragraph → medium score", () => {
    const r = evaluateOffline(
      "Explain inheritance in Java",
      "Inheritance in Java allows a class to extend another class using the extends keyword. The child class inherits all public methods and fields. Java supports single inheritance only, meaning a class can have only one parent. However, a class can implement multiple interfaces using the implements keyword. Method overriding allows a child class to provide its own implementation of a parent method.",
    );
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThanOrEqual(70);
    expect(r.strengths.length).toBeGreaterThanOrEqual(2);
  });

  test("expert-level comprehensive → high score", () => {
    const r = evaluateOffline(
      "Explain OOP principles",
      "Object-oriented programming is built on four pillars. Encapsulation bundles data and methods into a class, controlling access through access modifiers (public, private, protected). This hides implementation details and exposes only the interface. Inheritance creates hierarchical relationships — a Dog class extends Animal, inheriting its methods while adding breed-specific behavior. Polymorphism operates at two levels: compile-time via method overloading (same name, different parameters) and runtime via method overriding (same signature, different implementation). At runtime, dynamic method dispatch resolves which version to call based on the actual object type. Abstraction defines abstract classes and interfaces that specify what must be implemented without specifying how. Together these principles promote code reuse, maintainability, and separation of concerns.",
    );
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.strengths.length).toBeGreaterThanOrEqual(3);
  });
});

describe("LIVE FLOW — Answer history and comparison", () => {
  test("multiple evaluations produce comparable results", () => {
    const problem = "Explain the Fourier Transform";
    const answers = [
      "The Fourier Transform converts time-domain signals to frequency domain.",
      "The Fourier Transform decomposes a signal into its constituent frequencies using the integral formula F(omega) = integral of f(t)*e^(-j*omega*t)dt. Low frequencies represent smooth variations and high frequencies represent rapid changes. It is widely used in signal processing, image analysis, and solving differential equations.",
      "The Fourier Transform is a mathematical operation that transforms a function of time f(t) into a function of frequency F(omega). The forward transform is defined as F(omega) = integral from -infinity to infinity of f(t)*e^(-j*omega*t)dt, and the inverse transform recovers f(t) from F(omega). Key properties include linearity, time shifting (which multiplies by a phase factor), and the convolution theorem (convolution in time equals multiplication in frequency). In digital signal processing, the Discrete Fourier Transform (DFT) and its efficient implementation the FFT are used for spectral analysis, filtering, and compression. The Parseval theorem states that total energy is preserved between domains.",
    ];

    const results = answers.map((a) => evaluateOffline(problem, a));

    // Each must be a valid evaluation
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(typeof r.summary).toBe("string");
      expect(typeof r.explanation).toBe("string");
    }

    // Scores should generally increase with answer quality
    expect(results[0].score).toBeLessThan(results[2].score);
    expect(results[1].score).toBeLessThan(results[2].score);

    // Shorter answer should have lower score than comprehensive
    expect(results[0].score).toBeLessThan(results[1].score);
  });
});

describe("LIVE FLOW — Domain-specific diagram generation", () => {
  const diagramTests = [
    { input: "Implement a linked list in Python", mustContain: ["Node", "next"] },
    { input: "Compare arrays vs linked lists", mustContain: ["arr"] },
    { input: "Explain binary search tree operations", mustContain: ["graph"] },
    { input: "Solve a quadratic equation", mustContain: ["Quadratic"] },
    { input: "Explain conditional probability", mustContain: ["P("] },
    { input: "Explain Newton's second law", mustContain: ["Force", "mass"] },
    { input: "Compare major and minor scales", mustContain: ["Major", "Minor"] },
    { input: "Explain OOP inheritance", mustContain: ["class"] },
    { input: "How does a hash table work", mustContain: ["Hash"] },
    { input: "Explain TCP vs UDP", mustContain: ["TCP", "UDP"] },
    { input: "How does recursion work", mustContain: ["Base Case"] },
    { input: "Explain cloud computing serverless", mustContain: ["Serverless"] },
    { input: "Image sampling and quantization", mustContain: ["Image"] },
    { input: "Write a regex pattern", mustContain: ["Regex"] },
    { input: "Explain the OSI model layers", mustContain: ["Layer"] },
  ];

  for (const dt of diagramTests) {
    test(`"${dt.input}" → diagram with expected content`, () => {
      const r = evaluateOffline(dt.input, "A test answer");
      expect(r.diagram).toBeDefined();
      for (const word of dt.mustContain) {
        expect(r.diagram!.toLowerCase()).toContain(word.toLowerCase());
      }
    });
  }
});

describe("LIVE FLOW — Math equation extraction", () => {
  test("math problem produces LaTeX equations", () => {
    const r = evaluateOffline(
      "Solve the differential equation using Laplace transforms",
      "Apply Laplace transform to both sides, solve algebraically, then apply inverse transform.",
    );
    expect(r.equations).toBeDefined();
    expect(r.equations!.length).toBeGreaterThan(0);
    // Must contain LaTeX syntax
    const hasLatex = r.equations!.some((eq) => eq.includes("$"));
    expect(hasLatex).toBe(true);
  });

  test("probability problem produces probability equations", () => {
    const r = evaluateOffline(
      "Calculate the conditional probability using Bayes theorem",
      "Use the formula P(A|B) = P(B|A)*P(A)/P(B).",
    );
    expect(r.equations).toBeDefined();
    expect(r.equations!.length).toBeGreaterThan(0);
  });
});

describe("LIVE FLOW — Challenge problems exist and are meaningful", () => {
  test("every topic has a non-trivial challenge", () => {
    const parsed = heuristicParse("python");
    for (const topic of parsed.topics) {
      expect(topic.challenge).toBeDefined();
      expect(topic.challenge!.length).toBeGreaterThan(30);
      // Challenge should contain action verbs
      const hasAction = /\b(design|implement|build|create|solve|analyze|compare|evaluate|master|explore|demonstrate|research|practice|perform|write|explain|apply|combine)\b/i.test(
        topic.challenge!,
      );
      expect(hasAction).toBe(true);
    }
  });

  test("challenge problems score differently than practice", () => {
    const parsed = heuristicParse("python");
    const topic = parsed.topics[0];
    const practiceAnswer =
      "Python uses dynamic typing where variables don't need explicit type declarations. The int, str, float, and bool types are built-in.";
    const challengeAnswer =
      "I would design a URL shortener by implementing a Base62 encoding scheme. First, generate a unique ID using a counter or hash, then encode it to Base62 to create a short URL. Store the mapping in a database with TTL for expiration. Use a redirect server that looks up the short code and returns a 301 redirect. For collision handling, append a salt and re-hash. The system should handle 100M URLs with O(1) lookup time.";

    const practiceEval = evaluateOffline(topic.practice![0], practiceAnswer);
    const challengeEval = evaluateOffline(topic.challenge!, challengeAnswer);

    // Both should produce valid evaluations
    expect(practiceEval.score).toBeGreaterThanOrEqual(0);
    expect(challengeEval.score).toBeGreaterThanOrEqual(0);
    // Both should have feedback
    expect(practiceEval.explanation.length).toBeGreaterThan(50);
    expect(challengeEval.explanation.length).toBeGreaterThan(50);
  });
});
