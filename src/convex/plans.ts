import OpenAI from "openai";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  addDaysToDayKey,
  heuristicParse,
  type ParsedTopic,
} from "./lib";

// ── AI ingestion ────────────────────────────────────────────────────────────
// Optional accelerator: turns any syllabus text into sequenced topics.
// When no OPENAI_API_KEY is configured, the client falls back to the
// deterministic heuristic parser — the app never blocks on AI.

function normalizeTopics(input: unknown): ParsedTopic[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      const t = raw as Record<string, unknown>;
      const title = String(t?.title ?? "").trim().slice(0, 120);
      const hours = Math.min(8, Math.max(0.5, Math.round(Number(t?.hours ?? 2) * 4) / 4));
      const level = Math.min(3, Math.max(1, Math.round(Number(t?.level ?? 2))));
      return { title, hours, level };
    })
    .filter((t) => t.title.length > 1)
    .slice(0, 40);
}

export const ingestSyllabus = action({
  args: { rawInput: v.string() },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("NO_AI_KEY");

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Cadence's curriculum planner. From the user's syllabus text or subject description, produce a JSON object: " +
            '{"title": string (short plan name), "topics": [{"title": string, "hours": number, "level": number}]}. ' +
            "Order topics fundamentals-first and build toward advanced material (never document order for its own sake). " +
            "hours is focused study time per topic, between 0.5 and 6, realistic for a diligent human. " +
            "level is 1 (foundations), 2 (core), or 3 (advanced). Produce between 5 and 24 topics. Return only JSON.",
        },
        { role: "user", content: args.rawInput.slice(0, 12_000) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("EMPTY_AI_RESPONSE");
    const parsed = JSON.parse(content) as { title?: string; topics?: unknown };
    const topics = normalizeTopics(parsed.topics);
    if (topics.length < 3) throw new Error("BAD_AI_RESPONSE");
    return {
      title: String(parsed.title ?? "").trim().slice(0, 80),
      topics,
    };
  },
});

// ── Plan creation + pacing engine ───────────────────────────────────────────

export const createPlan = mutation({
  args: {
    title: v.optional(v.string()),
    rawInput: v.string(),
    topics: v.optional(v.array(v.object({ title: v.string(), hours: v.number(), level: v.number() }))),
    hoursPerDay: v.number(),
    targetDays: v.number(),
    startDayKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    // Resolve topics: provided (AI) or deterministic heuristic.
    let sourceKind: "ai" | "heuristic" = "heuristic";
    let title = (args.title ?? "").trim().slice(0, 80);
    let topics = normalizeTopics(args.topics);
    if (topics.length >= 3) {
      sourceKind = "ai";
    } else {
      const fallback = heuristicParse(args.rawInput);
      topics = fallback.topics;
      if (!title) title = fallback.title;
    }
    if (!title) title = "Untitled plan";

    // Sequence fundamentals-first (stable sort keeps AI ordering within a level).
    const sequenced = topics
      .map((t, i) => ({ ...t, i }))
      .sort((a, b) => a.level - b.level || a.i - b.i);

    // Split any topic bigger than a day into honest, labelled parts.
    type Chunk = { title: string; hours: number; level: number; topicIdx: number };
    const chunks: Chunk[] = [];
    for (const t of sequenced) {
      const h = Math.min(12, Math.max(0.25, t.hours));
      const parts = Math.max(1, Math.ceil(h / args.hoursPerDay - 0.001));
      const partHours = Math.max(0.25, Math.round((h / parts) * 4) / 4);
      for (let p = 0; p < parts; p++) {
        chunks.push({
          title: parts > 1 ? `${t.title} (part ${p + 1} of ${parts})` : t.title,
          hours: partHours,
          level: t.level,
          topicIdx: t.i,
        });
      }
    }

    // Fill days without ever exceeding hoursPerDay.
    const hoursPerDay = Math.min(10, Math.max(0.5, args.hoursPerDay));
    const days: { remaining: number; items: Chunk[] }[] = [];
    for (const chunk of chunks) {
      let day = days.find((d) => d.remaining >= chunk.hours - 0.001);
      if (!day) {
        day = { remaining: hoursPerDay, items: [] };
        days.push(day);
      }
      day.items.push(chunk);
      day.remaining -= chunk.hours;
    }

    const now = Date.now();
    const accent = Math.floor(Math.random() * 5);
    const planId = await ctx.db.insert("plans", {
      userId,
      title,
      sourceExcerpt: args.rawInput.slice(0, 2000),
      sourceKind,
      hoursPerDay,
      targetDays: args.targetDays,
      scheduledDays: days.length,
      status: "active",
      accent,
      createdAt: now,
    });

    const topicIds: (Id<"topics"> | undefined)[] = [];
    for (const t of sequenced) {
      topicIds[t.i] = await ctx.db.insert("topics", {
        planId,
        idx: t.i,
        title: t.title,
        hours: t.hours,
        level: t.level,
      });
    }

    for (let d = 0; d < days.length; d++) {
      let order = 0;
      for (const item of days[d].items) {
        await ctx.db.insert("tasks", {
          userId,
          planId,
          topicId: topicIds[item.topicIdx],
          title: item.title,
          kind: "learn",
          hours: item.hours,
          dayKey: addDaysToDayKey(args.startDayKey, d),
          dayIndex: d + 1,
          order: order++,
          status: "open",
          carried: false,
          reviewSpawned: false,
          createdAt: now,
        });
      }
    }

    return { planId, scheduledDays: days.length, usedAI: sourceKind === "ai" };
  },
});

// ── Queries ─────────────────────────────────────────────────────────────────

const ACCENTS = ["#E85A2A", "#2A9D8F", "#E9B44C", "#7B6CF0", "#DB2763"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const plans = await ctx.db
      .query("plans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return Promise.all(
      plans.map(async (plan) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_plan", (q) => q.eq("planId", plan._id))
          .collect();
        const doneTasks = tasks.filter((t) => t.status === "done");
        const openLearnHours = tasks
          .filter((t) => t.status === "open" && t.kind === "learn")
          .reduce((sum, t) => sum + t.hours, 0);
        const totalHours = tasks
          .filter((t) => t.kind === "learn")
          .reduce((sum, t) => sum + t.hours, 0);
        return {
          _id: plan._id,
          title: plan.title,
          hoursPerDay: plan.hoursPerDay,
          targetDays: plan.targetDays,
          scheduledDays: plan.scheduledDays,
          accent: ACCENTS[plan.accent % ACCENTS.length],
          totalTopics: tasks.filter((t) => t.kind === "learn" && !t.title.includes("(part ")).length,
          doneCount: doneTasks.length,
          totalCount: tasks.length,
          openLearnHours: Math.round(openLearnHours * 4) / 4,
          totalHours: Math.round(totalHours * 4) / 4,
          createdAt: plan.createdAt,
        };
      }),
    );
  },
});

export const detail = query({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) return null;

    const [topics, tasks] = await Promise.all([
      ctx.db.query("topics").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
      ctx.db.query("tasks").withIndex("by_plan", (q) => q.eq("planId", plan._id)).collect(),
    ]);

    const topicTitle = new Map(topics.map((t) => [t._id, t.title]));
    const byDay = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const list = byDay.get(task.dayKey) ?? [];
      list.push(task);
      byDay.set(task.dayKey, list);
    }
    const days = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dayKey, dayTasks]) => ({
        dayKey,
        dayIndex: dayTasks[0]?.dayIndex ?? 0,
        tasks: dayTasks
          .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
          .map((t) => ({
            _id: t._id,
            title: t.title,
            kind: t.kind,
            hours: t.hours,
            status: t.status,
            carried: t.carried,
            reviewStage: t.reviewStage,
            parentTopic: t.topicId ? topicTitle.get(t.topicId) : undefined,
          })),
      }));

    return {
      _id: plan._id,
      title: plan.title,
      sourceExcerpt: plan.sourceExcerpt,
      sourceKind: plan.sourceKind,
      hoursPerDay: plan.hoursPerDay,
      targetDays: plan.targetDays,
      scheduledDays: plan.scheduledDays,
      accent: ACCENTS[plan.accent % ACCENTS.length],
      topics: topics.sort((a, b) => a.idx - b.idx).map((t) => ({ _id: t._id, title: t.title, hours: t.hours, level: t.level })),
      days,
    };
  },
});
