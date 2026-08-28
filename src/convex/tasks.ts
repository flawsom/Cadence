import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { addDaysToDayKey, dayKeyToUtcMs, utcMsToDayKey, diffDays } from "./lib";
import type { DataModel, Id } from "./_generated/dataModel";
import type { GenericMutationCtx } from "convex/server";

const REVIEW_GAPS_DAYS = [1, 3, 7, 21];

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

// ── Today board ─────────────────────────────────────────────────────────────

export const getBoard = query({
  args: { todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [plans, tasks] = await Promise.all([
      ctx.db
        .query("plans")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", userId).eq("dayKey", args.todayKey),
        )
        .collect(),
    ]);

    const planById = new Map(plans.map((p) => [p._id, p]));
    const boardTasks = tasks
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
      .map((t) => {
        const plan = planById.get(t.planId);
        return {
          _id: t._id,
          title: t.title,
          kind: t.kind,
          hours: t.hours,
          status: t.status,
          carried: t.carried,
          reviewStage: t.reviewStage,
          planId: t.planId,
          planTitle: plan?.title ?? "Plan",
          planAccent: (plan?._creationTime ?? 0) % 5,
        };
      });

    const open = boardTasks.filter((t) => t.status === "open");
    return {
      tasks: boardTasks,
      activePlans: plans.map((p) => ({ _id: p._id, title: p.title })),
      plannedHours: roundQuarter(open.reduce((s, t) => s + t.hours, 0)),
      doneHours: roundQuarter(
        boardTasks.filter((t) => t.status === "done").reduce((s, t) => s + t.hours, 0),
      ),
      carriedCount: open.filter((t) => t.carried).length,
    };
  },
});

// ── Rollover: unfinished work moves forward, visibly ────────────────────────

export const syncRollover = mutation({
  args: { todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { moved: 0 };

    const all = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let moved = 0;
    for (const task of all) {
      if (task.status === "open" && task.dayKey < args.todayKey) {
        await ctx.db.patch(task._id, { dayKey: args.todayKey, carried: true });
        moved++;
      }
    }
    return { moved };
  },
});

// ── Completion + spaced reviews ─────────────────────────────────────────────

export const setTaskDone = mutation({
  args: {
    taskId: v.id("tasks"),
    done: v.boolean(),
    todayKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const task = await ctx.db.get(args.taskId);
    if (!task || task.userId !== userId) throw new Error("Task not found");

    if (!args.done) {
      // Un-completing never unschedules already-created reviews; they are real work now.
      await ctx.db.patch(task._id, { status: "open", doneAt: undefined, doneDayKey: undefined });
      return;
    }

    await ctx.db.patch(task._id, {
      status: "done",
      doneAt: Date.now(),
      doneDayKey: args.todayKey,
    });

    if (task.kind === "learn" && !task.reviewSpawned) {
      await spawnReviews(ctx, task.planId, userId, task.title, task.hours, task.dayKey, 0);
      await ctx.db.patch(task._id, { reviewSpawned: true });
    }

    if (task.kind === "review" && typeof task.reviewStage === "number") {
      const nextStage = task.reviewStage + 1; // stages are 1-based; next gap index = stage
      if (nextStage <= REVIEW_GAPS_DAYS.length) {
        await spawnReviews(
          ctx,
          task.planId,
          userId,
          task.title.replace(/^Review:\s*/, ""),
          task.hours / 0.35,
          task.dayKey,
          nextStage - 1,
        );
      }
    }
  },
});

async function spawnReviews(
  ctx: GenericMutationCtx<DataModel>,
  planId: Id<"plans">,
  userId: Id<"users">,
  topicTitle: string,
  learnHours: number,
  fromDayKey: string,
  stageIndex: number,
) {
  const gap = REVIEW_GAPS_DAYS[stageIndex];
  const hours = Math.min(1.5, Math.max(0.5, roundQuarter(learnHours * 0.35)));
  await ctx.db.insert("tasks", {
    userId,
    planId,
    title: `Review: ${topicTitle}`,
    kind: "review",
    hours,
    dayKey: addDaysToDayKey(fromDayKey, gap),
    dayIndex: 0,
    order: 1000 + stageIndex,
    status: "open",
    carried: false,
    reviewStage: stageIndex + 1,
    reviewSpawned: false,
    createdAt: Date.now(),
  });
}

// ── Stats: streak + heatmap, computed from real completions ─────────────────

export const getStats = query({
  args: { todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const hoursByDoneDay = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === "done" && t.doneDayKey) {
        hoursByDoneDay.set(t.doneDayKey, (hoursByDoneDay.get(t.doneDayKey) ?? 0) + t.hours);
      }
    }

    // Heatmap: last 119 days ending today.
    const todayMs = dayKeyToUtcMs(args.todayKey);
    const heatmap: { dayKey: string; hours: number }[] = [];
    for (let i = 118; i >= 0; i--) {
      const key = utcMsToDayKey(todayMs - i * 86_400_000);
      heatmap.push({ dayKey: key, hours: roundQuarter(hoursByDoneDay.get(key) ?? 0) });
    }

    // Streak: consecutive days with anything completed, ending today or yesterday.
    let streak = 0;
    let cursor =
      hoursByDoneDay.has(args.todayKey) ? todayMs : todayMs - 86_400_000;
    while (hoursByDoneDay.get(utcMsToDayKey(cursor)) !== undefined && hoursByDoneDay.get(utcMsToDayKey(cursor))! > 0) {
      streak++;
      cursor -= 86_400_000;
    }

    // Longest streak ever — scan all completion days.
    const sortedDays = [...hoursByDoneDay.entries()]
      .filter(([, h]) => h > 0)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    let longestStreak = 0;
    let currentRun = 0;
    let prevMs = 0;
    for (const [dayKey] of sortedDays) {
      const ms = dayKeyToUtcMs(dayKey);
      if (prevMs > 0 && ms - prevMs === 86_400_000) {
        currentRun++;
      } else {
        currentRun = 1;
      }
      if (currentRun > longestStreak) longestStreak = currentRun;
      prevMs = ms;
    }

    const reviewsDueToday = tasks.filter(
      (t) => t.kind === "review" && t.status === "open" && t.dayKey === args.todayKey,
    ).length;

    return {
      streak,
      longestStreak,
      heatmap,
      reviewsDueToday,
      totalCompleted: tasks.filter((t) => t.status === "done").length,
      totalHoursCompleted: roundQuarter(
        tasks.filter((t) => t.status === "done").reduce((s, t) => s + t.hours, 0),
      ),
    };
  },
});

// ── Review schedule for forgetting curve ───────────────────────────────────

export const getReviewSchedule = query({
  args: {
    todayKey: v.string(),
    lookaheadDays: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Fetch all review tasks (open and future-dated)
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const reviews = allTasks
      .filter((t) => t.kind === "review" && typeof t.reviewStage === "number")
      .filter((t) => {
        const dayDiff = diffDays(args.todayKey, t.dayKey);
        return dayDiff >= -7 && dayDiff <= args.lookaheadDays;
      })
      .map((t) => {
        // Find the corresponding learn task to determine when the topic was learned
        const learnTask = allTasks.find(
          (lt) => lt.kind === "learn" && lt.title === t.title.replace(/^Review:\s*/, ""),
        );
        const learnedDayKey = learnTask?.doneDayKey ?? t.dayKey;
        const learnedDaysAgo = diffDays(learnedDayKey, args.todayKey);

        return {
          taskId: t._id,
          title: t.title.replace(/^Review:\s*/, ""),
          reviewStage: t.reviewStage,
          dayKey: t.dayKey,
          status: t.status,
          hours: t.hours,
          learnedDaysAgo: Math.abs(learnedDaysAgo),
        };
      });

    return { reviews };
  },
});
