import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { buildBoards } from "./pods";
import { todayISO } from "../lib/planning";
import type { Id } from "./_generated/dataModel";

const crons = cronJobs();

/**
 * Daily pod activity digest — runs every day at 9am UTC.
 */
crons.cron("pod-digest", "0 9 * * *", api.crons.generateWeekly);

/**
 * Review reminders — runs every day at 8am UTC.
 * Sends push notifications to users who have review tasks due today.
 */
crons.cron("review-reminders", "0 8 * * *", api.crons.sendReviewReminders);

/**
 * Streak-at-risk alerts — runs every day at 6pm UTC.
 * Warns users who haven't completed any tasks today that their streak is at risk.
 */
crons.cron("streak-alerts", "0 18 * * *", api.crons.sendStreakAlerts);

/**
 * Generate and store a daily digest for every active pod.
 * Called by the cron scheduler above, or manually via mutation.
 */
export const generateWeekly = mutation({
  args: {},
  handler: async (ctx) => {
    const pods = await ctx.db.query("pods").collect();
    const now = Date.now();

    for (const pod of pods) {
      const memberRows = await ctx.db
        .query("podMembers")
        .withIndex("by_pod", (q) => q.eq("podId", pod._id))
        .collect();

      if (memberRows.length === 0) continue;

      const todayKey = new Date().toISOString().slice(0, 10);
      const boards = await buildBoards(ctx, pod, pod.ownerId, todayKey, 7);

      const memberStats = boards.members.map((m) => {
        const weeklyHours = m.series.reduce((s, d) => s + d.hours, 0);
        const totalDone = m.plans.reduce((s, p) => s + p.doneTasks, 0);
        const totalTasks = m.plans.reduce((s, p) => s + p.totalTasks, 0);
        return {
          name: m.name,
          weeklyHours: Math.round(weeklyHours * 4) / 4,
          totalDone,
          totalTasks,
          planCount: m.plans.length,
        };
      });

      memberStats.sort((a, b) => b.weeklyHours - a.weeklyHours);

      const totalPodHours = memberStats.reduce((s, m) => s + m.weeklyHours, 0);
      const topPerformer = memberStats[0];

      await ctx.db.insert("podDigests", {
        podId: pod._id,
        weekEnding: todayKey,
        memberStats,
        totalPodHours: Math.round(totalPodHours * 4) / 4,
        topPerformerName: topPerformer?.name ?? "Nobody",
        createdAt: now,
      });
    }

    return { podsProcessed: pods.length };
  },
});

/**
 * Get the latest digest for the current user's pod.
 */
export const latestDigest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const digest = await ctx.db
      .query("podDigests")
      .withIndex("by_pod", (q) => q.eq("podId", membership.podId))
      .order("desc")
      .first();

    return digest;
  },
});

/**
 * Send push notifications to users with review tasks due today.
 */
export const sendReviewReminders = mutation({
  args: {},
  handler: async (ctx) => {
    const todayKey = todayISO();
    const usersWithReviews = new Map<Id<"users">, number>();

    // Use the by_plan index on tasks — iterate all plans first, then scan per-plan.
    // This avoids the O(all_tasks) full scan that was here before.
    const plans = await ctx.db.query("plans").collect();
    for (const plan of plans) {
      const planTasks = await ctx.db
        .query("tasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();

      for (const task of planTasks) {
        if (task.dayKey === todayKey && task.kind === "review" && task.status === "open") {
          const count = usersWithReviews.get(task.userId) || 0;
          usersWithReviews.set(task.userId, count + 1);
        }
      }
    }

    let notified = 0;
    for (const [userId, reviewCount] of usersWithReviews) {
      const subs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      if (subs.length === 0) continue;

      const payload = {
        title: "Review time! 📚",
        body: `You have ${reviewCount} review${reviewCount > 1 ? "s" : ""} due today. Keep your retention strong!`,
        url: "./dashboard",
        tag: "review-" + todayKey,
      };

      await ctx.scheduler.runAfter(0, api.actions.pushDelivery.sendPushBatch, {
        subscriptions: subs.map((s) => ({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
        })),
        payload,
      });
      notified++;
    }

    return { notified, totalReviews: [...usersWithReviews.values()].reduce((s, c) => s + c, 0) };
  },
});

/**
 * Send streak-at-risk push notifications.
 * Users who haven't completed any tasks today get warned before midnight.
 */
export const sendStreakAlerts = mutation({
  args: {},
  handler: async (ctx) => {
    const todayKey = todayISO();
    const usersToAlert = new Map<Id<"users">, number>(); // userId -> streak length

    // Find users with active plans, then scan their tasks via index.
    const plans = await ctx.db.query("plans").collect();
    const userDoneToday = new Map<Id<"users">, Set<string>>();
    const userOpenToday = new Map<Id<"users">, Set<string>>();

    for (const plan of plans) {
      const planTasks = await ctx.db
        .query("tasks")
        .withIndex("by_plan", (q) => q.eq("planId", plan._id))
        .collect();

      for (const task of planTasks) {
        if (task.dayKey === todayKey) {
          if (task.status === "done" && task.doneDayKey === todayKey) {
            if (!userDoneToday.has(task.userId)) userDoneToday.set(task.userId, new Set());
            userDoneToday.get(task.userId)!.add(task._id);
          }
          if (task.status === "open") {
            if (!userOpenToday.has(task.userId)) userOpenToday.set(task.userId, new Set());
            userOpenToday.get(task.userId)!.add(task._id);
          }
        }
      }
    }

    // Users with open tasks but nothing completed today need a nudge
    for (const [userId] of userOpenToday) {
      const completedToday = userDoneToday.get(userId);
      if (!completedToday || completedToday.size === 0) {
        const existing = usersToAlert.get(userId) || 0;
        usersToAlert.set(userId, Math.max(existing, 1));
      }
    }

    let alerted = 0;
    for (const [userId] of usersToAlert) {
      const subs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      if (subs.length === 0) continue;

      // Count consecutive done days for streak calculation (index-based)
      const userTasks = await ctx.db
        .query("tasks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      const doneDays = new Set(
        userTasks.filter((t) => t.status === "done" && t.doneDayKey).map((t) => t.doneDayKey!)
      );
      let streak = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const key = d.toISOString().slice(0, 10);
        if (doneDays.has(key)) streak++;
        else break;
        d.setDate(d.getDate() - 1);
      }

      const payload = {
        title: streak > 0 ? `Don't break your ${streak}-day streak! 🔥` : "Time to study! 📖",
        body: streak > 0
          ? `You've studied ${streak} days in a row. Complete today's tasks to keep it going!`
          : "You have tasks waiting. Start your learning streak today!",
        url: "./dashboard",
        tag: "streak-" + todayKey,
      };

      await ctx.scheduler.runAfter(0, api.actions.pushDelivery.sendPushBatch, {
        subscriptions: subs.map((s) => ({
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
        })),
        payload,
      });
      alerted++;
    }

    return { alerted };
  },
});

export default crons;
