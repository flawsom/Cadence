"use node";

/**
 * AI-assisted syllabus ingestion via a LOCAL LLM.
 *
 * Talks to any OpenAI-compatible endpoint — Ollama (`ollama serve` exposes
 * one at http://127.0.0.1:11434/v1), llama.cpp's server, LM Studio, vLLM —
 * so Cadence never needs a paid API key or an external service.
 *
 * Environment variables (all optional):
 *   LLM_BASE_URL  default: http://127.0.0.1:11434/v1
 *   LLM_MODEL     default: qwen2.5:1.5b-instruct
 *   LLM_API_KEY   optional Bearer token (some gateways require one)
 *
 * Every failure mode throws; the client falls back to the deterministic
 * heuristic parser in ./lib so the product never blocks on AI.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { SYLLABUS_SYSTEM_PROMPT, normalizeTopics } from "./lib";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "qwen2.5:1.5b-instruct";
const TIMEOUT_MS = 180_000;

export const ingestSyllabus = action({
  args: { rawInput: v.string() },
  handler: async (_ctx, args) => {
    const baseUrl = (process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;

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
            { role: "system", content: SYLLABUS_SYSTEM_PROMPT },
            { role: "user", content: args.rawInput.slice(0, 12_000) },
          ],
          temperature: 0.2,
          max_tokens: 2048,
          // Ask for strict JSON where the server supports it; ignored otherwise.
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

    let parsed: { title?: unknown; topics?: unknown };
    try {
      parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as typeof parsed;
    } catch {
      throw new Error("NO_LLM_NOT_JSON");
    }

    const topics = normalizeTopics(parsed.topics);
    if (topics.length < 3) throw new Error("NO_LLM_TOO_FEW_TOPICS");

    return {
      title: String(parsed.title ?? "").trim().slice(0, 80),
      topics,
      model,
    };
  },
});
