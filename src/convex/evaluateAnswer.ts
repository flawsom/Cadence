"use node";

/**
 * AI-powered answer evaluation — talks to the local LLM to produce
 * professor-level feedback on user-submitted answers.
 *
 * Returns structured feedback: score, strengths, weaknesses, explanation,
 * improved answer, optional diagrams, and LaTeX equations.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "qwen3:4b";
const TIMEOUT_MS = 120_000;

const EVALUATION_PROMPT = `You are a world-class professor and teaching assistant. Evaluate the student's answer to the given practice problem with extreme rigor and detail.

RULES:
1. Score from 0-100. Be honest — most answers deserve 40-80, not 90+.
2. Strengths: list 2-4 specific things the answer does well.
3. Weaknesses: list 2-4 specific things that are wrong, incomplete, or could be better.
4. Explanation: write a professor-level explanation (300-800 words) covering:
   - What the correct answer should address
   - Key concepts the student needs to understand
   - Common misconceptions to avoid
   - Step-by-step reasoning for the correct approach
5. improvedAnswer: write an ideal answer the student can compare against.
6. If the problem involves math/science, include relevant equations in LaTeX wrapped in $ signs.
7. If a visual explanation would help, include a "diagram" field with a Mermaid diagram definition (flowchart, sequence, or graph).
8. Be encouraging but brutally honest. A student learns more from truth than from praise.

Return ONLY valid JSON with this structure:
{
  "score": number,
  "summary": "one sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improvedAnswer": "ideal answer text",
  "explanation": "detailed professor-level explanation",
  "diagram": "optional mermaid diagram",
  "equations": ["optional LaTeX equation 1", "optional LaTeX equation 2"]
}`;

export const evaluate = action({
  args: {
    answerId: v.id("answers"),
    problemText: v.string(),
    userAnswer: v.string(),
    topicContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;

    const userMessage = [
      args.topicContext ? `Topic context: ${args.topicContext}` : "",
      `Problem: ${args.problemText}`,
      `Student's answer: ${args.userAnswer}`,
      "",
      "Evaluate this answer with detailed feedback, a score, and a professor-level explanation.",
    ]
      .filter(Boolean)
      .join("\n");

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.LLM_API_KEY
            ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: EVALUATION_PROMPT },
            { role: "user", content: userMessage.slice(0, 8000) },
          ],
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Error("NO_LLM");
    }

    if (!response.ok) throw new Error(`NO_LLM_${response.status}`);

    let content: string | undefined;
    try {
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      content = payload.choices?.[0]?.message?.content;
    } catch {
      throw new Error("NO_LLM_MALFORMED");
    }
    if (!content) throw new Error("NO_LLM_EMPTY");

    // Tolerate models that wrap JSON in prose or code fences.
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) throw new Error("NO_LLM_NOT_JSON");

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
    } catch {
      throw new Error("NO_LLM_NOT_JSON");
    }

    // Normalize the response into our schema shape.
    const feedback = {
      summary: String(parsed.summary ?? "").trim().slice(0, 300),
      strengths: Array.isArray(parsed.strengths)
        ? (parsed.strengths as unknown[]).map((s) => String(s).trim().slice(0, 200)).slice(0, 5)
        : [],
      weaknesses: Array.isArray(parsed.weaknesses)
        ? (parsed.weaknesses as unknown[]).map((w) => String(w).trim().slice(0, 200)).slice(0, 5)
        : [],
      improvedAnswer: parsed.improvedAnswer
        ? String(parsed.improvedAnswer).trim().slice(0, 3000)
        : undefined,
      explanation: String(parsed.explanation ?? "").trim().slice(0, 5000),
      diagram: parsed.diagram ? String(parsed.diagram).trim().slice(0, 2000) : undefined,
      equations: Array.isArray(parsed.equations)
        ? (parsed.equations as unknown[]).map((e) => String(e).trim().slice(0, 500)).slice(0, 10)
        : undefined,
    };

    const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50)));

    // Save the evaluation back to the database.
    await ctx.runMutation(api.answers.saveEvaluation, {
      answerId: args.answerId,
      score,
      feedback,
    });

    return { score, feedback };
  },
});
