import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  addDaysToDayKey,
  heuristicParse,
  normalizeTopics,
  type ParsedTopic,
} from "./lib";

// ── Plan creation + pacing engine ────────────────────────────────────────

export const createPlan = mutation({
  args: {
    title: v.optional(v.string()),
    rawInput: v.string(),
    topics: v.optional(v.array(v.object({
      title: v.string(),
      hours: v.number(),
      level: v.number(),
      practice: v.optional(v.array(v.string())),
      challenge: v.optional(v.string()),
    }))),
    hoursPerDay: v.number(),
    targetDays: v.number(),
    startDayKey: v.string(),
    schedulingMode: v.optional(v.union(v.literal("parallel"), v.literal("sequential"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    // Resolve topics: provided (AI-assisted client flow) or deterministic heuristic.
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

    // Sequence fundamentals-first (stable sort keeps ordering within a level).
    const sequenced = topics
      .map((t, i) => ({ ...t, i }))
      .sort((a, b) => a.level - b.level || a.i - b.i);

    // Split any topic bigger than a day into honest, labelled parts.
    type Chunk = {
      title: string;
      hours: number;
      level: number;
      topicIdx: number;
      practice?: string[];
      challenge?: string;
    };
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
          // Only attach practice/challenge to the last part (completion).
          practice: p === parts - 1 ? t.practice : undefined,
          challenge: p === parts - 1 ? t.challenge : undefined,
        });
      }
    }

    // Scheduling mode:
    //  - "parallel" (default): share daily budget across ALL active plans.
    //  - "sequential": new plan starts after ALL existing open tasks are done.
    const mode = args.schedulingMode ?? "parallel";
    const openTasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let effectiveStartDayKey = args.startDayKey;
    if (mode === "sequential" && openTasks.length > 0) {
      // Find the latest dayKey among all open tasks, then start the day after.
      const lastDay = openTasks
        .filter((t) => t.status === "open")
        .map((t) => t.dayKey)
        .sort()[openTasks.filter((t) => t.status === "open").length - 1];
      if (lastDay && lastDay >= args.startDayKey) {
        effectiveStartDayKey = addDaysToDayKey(lastDay, 1);
      }
    }

    const loadByDay = new Map<string, number>();
    for (const t of openTasks) {
      if (t.status === "open") {
        loadByDay.set(t.dayKey, (loadByDay.get(t.dayKey) ?? 0) + t.hours);
      }
    }

    const hoursPerDay = Math.min(10, Math.max(0.5, args.hoursPerDay));
    const roundQuarter = (n: number) => Math.round(n * 4) / 4;

    let offset = 0;
    let guard = 0;
    const perDayOrder = new Map<number, number>();
    const placed: Array<Chunk & { dayOffset: number }> = [];
    for (const chunk of chunks) {
      let placedForChunk = false;
      while (!placedForChunk) {
        if (guard++ > 5000) throw new Error("Could not fit this plan into a schedule");
        const key = addDaysToDayKey(effectiveStartDayKey, offset);
        const existing = loadByDay.get(key) ?? 0;
        const remaining = Math.max(0, roundQuarter(hoursPerDay - existing));
        if (remaining >= chunk.hours - 0.001) {
          loadByDay.set(key, roundQuarter(existing + chunk.hours));
          placed.push({ ...chunk, dayOffset: offset });
          placedForChunk = true;
        } else {
          offset++;
        }
      }
    }

    const scheduledDays = placed.length > 0 ? Math.max(...placed.map((c) => c.dayOffset)) + 1 : 1;

    const now = Date.now();
    const accent = Math.floor(Math.random() * 5);
    const planId = await ctx.db.insert("plans", {
      userId,
      title,
      sourceExcerpt: args.rawInput.slice(0, 2000),
      sourceKind,
      hoursPerDay,
      targetDays: args.targetDays,
      scheduledDays,
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

    for (const item of placed) {
      const order = perDayOrder.get(item.dayOffset) ?? 0;
      perDayOrder.set(item.dayOffset, order + 1);
      await ctx.db.insert("tasks", {
        userId,
        planId,
        topicId: topicIds[item.topicIdx],
        title: item.title,
        kind: "learn",
        hours: item.hours,
        dayKey: addDaysToDayKey(effectiveStartDayKey, item.dayOffset),
        dayIndex: item.dayOffset + 1,
        order,
        status: "open",
        carried: false,
        reviewSpawned: false,
        practiceProblems: item.practice,
        challengeProblem: item.challenge,
        createdAt: now,
      });
    }

    return { planId, scheduledDays, usedSequencing: sequenced.length > 0 };
  },
});

export const archivePlan = mutation({
  args: { planId: v.id("plans"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.userId !== userId) throw new Error("Plan not found");

    await ctx.db.patch(plan._id, { status: args.archived ? "archived" : "active" });

    if (args.archived) {
      // Archived plans stop counting against the daily budget.
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();
      const todayKey = new Date().toISOString().slice(0, 10);
      for (const t of tasks) {
        if (t.status === "open" && t.kind === "learn" && t.dayKey >= todayKey) {
          await ctx.db.delete(t._id);
        }
      }
    }
  },
});

// ── Queries ──────────────────────────────────────────────────────────────

const ACCENTS = ["#E85A2A", "#2A9D8F", "#E9B44C", "#7B6CF0", "#DB2763"];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

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
          sourceKind: plan.sourceKind,
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
            practiceProblems: t.practiceProblems,
            challengeProblem: t.challengeProblem,
            planId: t.planId,
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
