import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { buildBoards } from "./pods";
import { todayISO } from "../lib/planning";

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
    const usersWithReviews = new Map<any, number>();

    // Find all review tasks due today (filter in memory since index requires userId first)
    const allTasks = await ctx.db.query("tasks").collect();
    const reviewTasks = allTasks.filter((t) => t.dayKey === todayKey && t.kind === "review" && t.status === "open");

    for (const task of reviewTasks) {
      if (task.kind === "review" && task.status === "open") {
        const uid = task.userId as any;
        const count = usersWithReviews.get(uid) || 0;
        usersWithReviews.set(uid, count + 1);
      }
    }

    let notified = 0;
    for (const [userId, reviewCount] of usersWithReviews) {
      const subs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId as any))
        .collect();

      if (subs.length === 0) continue;

      // Store the notification intent — the push delivery happens via the action
      const payload = {
        title: "Review time! 📚",
        body: `You have ${reviewCount} review${reviewCount > 1 ? "s" : ""} due today. Keep your retention strong!`,
        url: "./dashboard",
        tag: "review-" + todayKey,
      };

      // Fire-and-forget: schedule the push delivery
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
    const usersToAlert = new Map<any, number>(); // userId -> streak length

    // Find users with active plans
    const allTasks = await ctx.db.query("tasks").collect();
    const userTaskCounts = new Map<any, Set<string>>();
    for (const task of allTasks) {
      if (task.status === "done" && task.doneDayKey === todayKey) {
        const uid = task.userId as any;
        if (!userTaskCounts.has(uid)) userTaskCounts.set(uid, new Set());
        userTaskCounts.get(uid)!.add(task._id);
      }
    }

    // Check which users have open tasks but haven't completed any today
    const openTasks = allTasks.filter((t) => t.status === "open" && t.dayKey === todayKey);
    for (const task of openTasks) {
      const uid = task.userId as any;
      const completedToday = userTaskCounts.get(uid);
      if (!completedToday || completedToday.size === 0) {
        const existing = usersToAlert.get(uid) || 0;
        usersToAlert.set(uid, Math.max(existing, 1));
      }
    }

    // Get streak data for these users
    let alerted = 0;
    for (const [userId] of usersToAlert) {
      const subs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId as any))
        .collect();

      if (subs.length === 0) continue;

      // Count consecutive done days (rough streak check)
      const userTasks = allTasks.filter((t) => t.userId === userId && t.status === "done");
      const doneDays = new Set(userTasks.map((t) => t.doneDayKey).filter(Boolean));
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
