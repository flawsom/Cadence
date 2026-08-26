import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Submit an answer ───────────────────────────────────────────────────

export const submit = mutation({
  args: {
    taskId: v.id("tasks"),
    planId: v.id("plans"),
    problemIndex: v.number(),
    problemText: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const answerId = await ctx.db.insert("answers", {
      userId,
      taskId: args.taskId,
      planId: args.planId,
      problemIndex: args.problemIndex,
      problemText: args.problemText,
      answer: args.answer.slice(0, 5000),
      status: "submitted",
      createdAt: Date.now(),
    });

    return { answerId };
  },
});

// ── Save evaluation result (called by the action after LLM responds) ──

export const saveEvaluation = mutation({
  args: {
    answerId: v.id("answers"),
    score: v.number(),
    feedback: v.object({
      summary: v.string(),
      strengths: v.array(v.string()),
      weaknesses: v.array(v.string()),
      improvedAnswer: v.optional(v.string()),
      explanation: v.string(),
      diagram: v.optional(v.string()),
      equations: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const answer = await ctx.db.get(args.answerId);
    if (!answer || answer.userId !== userId) throw new Error("Answer not found");

    await ctx.db.patch(args.answerId, {
      score: Math.min(100, Math.max(0, Math.round(args.score))),
      feedback: args.feedback,
      status: "evaluated",
      evaluatedAt: Date.now(),
    });
  },
});

// ── Mark evaluation as errored ────────────────────────────────────────

export const markError = mutation({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const answer = await ctx.db.get(args.answerId);
    if (!answer || answer.userId !== userId) throw new Error("Answer not found");

    await ctx.db.patch(args.answerId, { status: "error" });
  },
});

// ── Get all answers for a task ────────────────────────────────────────

export const byTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    return answers
      .filter((a) => a.userId === userId)
      .map((a) => ({
        _id: a._id,
        problemIndex: a.problemIndex,
        answer: a.answer,
        score: a.score,
        feedback: a.feedback,
        status: a.status,
        createdAt: a.createdAt,
        evaluatedAt: a.evaluatedAt,
      }));
  },
});

// ── Get user's answer history across all tasks ────────────────────────

export const userHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const answers = await ctx.db
      .query("answers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return answers.map((a) => ({
      _id: a._id,
      taskId: a.taskId,
      planId: a.planId,
      problemIndex: a.problemIndex,
      problemText: a.problemText.slice(0, 100),
      score: a.score,
      status: a.status,
      createdAt: a.createdAt,
    }));
  },
});
