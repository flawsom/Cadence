import { cronJobs } from "convex/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { buildBoards } from "./pods";

const crons = cronJobs();

/**
 * Weekly pod activity digest — runs every Monday at 9am UTC.
 */
crons.cron("pod-digest", "0 9 * * 1", api.crons.generateWeekly);

/**
 * Generate and store a weekly digest for every active pod.
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

export default crons;
