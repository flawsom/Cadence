import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function uniqueCode(db: MutationCtx["db"]): Promise<string> {
  let code = makeCode();
  for (let i = 0; i < 10; i++) {
    const existing = await db
      .query("pods")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!existing) break;
    code = makeCode();
  }
  return code;
}

/** Prettifies an email local-part without exposing the domain; anonymous users get a stable alias. */
function displayName(
  user: { name?: string; email?: string; isAnonymous?: boolean },
  seed: string,
): string {
  if (user.name) return user.name;
  if (!user.isAnonymous && user.email) {
    return user.email
      .split("@")[0]
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
  }
  return `Learner ${seed.slice(-4).toUpperCase()}`;
}

/**
 * The signed-in user's pod with every member's live progress for today.
 * Members appear by join date — deliberately never ranked.
 */
export const myPod = query({
  args: { todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const pod = await ctx.db.get(membership.podId);
    if (!pod) return null;

    const memberRows = await ctx.db
      .query("podMembers")
      .withIndex("by_pod", (q) => q.eq("podId", pod._id))
      .collect();

    const podCheckins = await ctx.db
      .query("checkins")
      .withIndex("by_pod", (q) => q.eq("podId", pod._id))
      .collect();

    let todayCheckins = 0;
    const members = [];
    for (const row of [...memberRows].sort((a, b) => a.joinedAt - b.joinedAt)) {
      const user = await ctx.db.get(row.userId);
      if (!user) continue;

      const todaysTasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", row.userId).eq("dayKey", args.todayKey),
        )
        .collect();

      const mineToday = podCheckins.find(
        (c) => c.userId === row.userId && c.dayKey === args.todayKey,
      );
      if (mineToday) todayCheckins++;

      members.push({
        userId: row.userId,
        name: displayName(user, row.userId),
        image: user.image,
        isYou: row.userId === userId,
        totalCount: todaysTasks.length,
        doneCount: todaysTasks.filter((t) => t.status === "done").length,
        plannedHours:
          Math.round(todaysTasks.reduce((s, t) => s + t.hours, 0) * 4) / 4,
        doneHours:
          Math.round(
            todaysTasks
              .filter((t) => t.status === "done")
              .reduce((s, t) => s + t.hours, 0) * 4,
          ) / 4,
        checkinNote: mineToday?.note ?? null,
      });
    }

    return {
      _id: pod._id,
      name: pod.name,
      code: pod.code,
      isOwner: pod.ownerId === userId,
      todayCheckins,
      members,
    };
  },
});

export const createPod = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    // A user belongs to one pod at a time — joining another means leaving this one.
    const existingMembership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingMembership) throw new Error("You're already in a pod");

    const code = await uniqueCode(ctx.db);
    const podId = await ctx.db.insert("pods", {
      name: args.name.trim().slice(0, 60) || "Study pod",
      code,
      ownerId: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("podMembers", {
      podId,
      userId,
      joinedAt: Date.now(),
    });
    return { podId, code };
  },
});

export const joinPod = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const existingMembership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existingMembership) throw new Error("You're already in a pod");

    const code = args.code.trim().toUpperCase();
    const pod = await ctx.db
      .query("pods")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!pod) throw new Error("No pod found with that code");

    await ctx.db.insert("podMembers", {
      podId: pod._id,
      userId,
      joinedAt: Date.now(),
    });
    return { podId: pod._id, name: pod.name };
  },
});

export const leavePod = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const membership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) throw new Error("You're not in a pod");
    const pod = await ctx.db.get(membership.podId);

    await ctx.db.delete(membership._id);

    // Owner leaving dissolves an empty pod rather than orphaning it.
    if (pod && pod.ownerId === userId) {
      const remaining = await ctx.db
        .query("podMembers")
        .withIndex("by_pod", (q) => q.eq("podId", pod._id))
        .collect();
      if (remaining.length === 0) {
        const checkins = await ctx.db
          .query("checkins")
          .withIndex("by_pod", (q) => q.eq("podId", pod._id))
          .collect();
        for (const c of checkins) await ctx.db.delete(c._id);
        await ctx.db.delete(pod._id);
      }
    }
  },
});

const round4 = (n: number) => Math.round(n * 4) / 4;

/**
 * Shared board builder — the single source of truth for pod boards.
 * Used by the authenticated `podBoards` query; testable in isolation.
 */
export async function buildBoards(
  ctx: { db: QueryCtx["db"] },
  pod: { _id: Id<"pods">; name: string; code: string },
  viewerId: Id<"users">,
  todayKey: string,
  windowDays = 14,
) {
  const memberRows = await ctx.db
    .query("podMembers")
    .withIndex("by_pod", (q) => q.eq("podId", pod._id))
    .collect();

  // Client-local day window ending at the caller's today.
  // Malformed keys fall back to UTC today rather than crashing the query.
  const safeTodayKey = /^\d{4}-\d{2}-\d{2}$/.test(todayKey)
    ? todayKey
    : new Date().toISOString().slice(0, 10);
  const days = Math.min(Math.max(windowDays, 7), 30);
  const end = new Date(`${safeTodayKey}T00:00:00Z`).getTime();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }

  const members = [];
  for (const row of [...memberRows].sort((a, b) => a.joinedAt - b.joinedAt)) {
    const user = await ctx.db.get(row.userId);
    if (!user) continue;

    // Subjects: every active plan with its lifetime + today's progress.
    const planRows = await ctx.db
      .query("plans")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .collect();
    const plans = [];
    for (const p of planRows.filter((p) => p.status === "active")) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_plan", (q) => q.eq("planId", p._id))
        .collect();
      const done = tasks.filter((t) => t.status === "done");
      const today = tasks.filter((t) => t.dayKey === safeTodayKey);
      plans.push({
        planId: p._id,
        title: p.title,
        accent: p.accent,
        totalTasks: tasks.length,
        doneTasks: done.length,
        plannedHours: round4(tasks.reduce((s, t) => s + t.hours, 0)),
        doneHours: round4(done.reduce((s, t) => s + t.hours, 0)),
        todayTotal: today.length,
        todayDone: today.filter((t) => t.status === "done").length,
      });
    }

    // Daily completed hours across the comparison window.
    const series = [];
    for (const dk of dayKeys) {
      const dayTasks = await ctx.db
        .query("tasks")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", row.userId).eq("dayKey", dk),
        )
        .collect();
      series.push({
        dayKey: dk,
        hours: round4(
          dayTasks
            .filter((t) => t.status === "done")
            .reduce((s, t) => s + t.hours, 0),
        ),
      });
    }

    members.push({
      userId: row.userId,
      name: displayName(user, row.userId),
      isYou: row.userId === viewerId,
      plans,
      series,
    });
  }

  return {
    _id: pod._id,
    name: pod.name,
    code: pod.code,
    dayKeys,
    members,
  };
}

/**
 * The pod's shared boards: every member's subjects (live progress) plus a
 * daily completed-hours series per member for side-by-side comparison.
 * Everything here is a reactive Convex query — progress updates propagate
 * to every pod member's window the moment a task is ticked.
 */
export const podBoards = query({
  args: { todayKey: v.string(), windowDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) return null;

    const pod = await ctx.db.get(membership.podId);
    if (!pod) return null;

    return buildBoards(ctx, pod, userId, args.todayKey, args.windowDays ?? 14);
  },
});

/** One check-in per person per day — posting again replaces the earlier note. */
export const checkIn = mutation({
  args: { note: v.string(), todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const membership = await ctx.db
      .query("podMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!membership) throw new Error("Join a pod first");

    const note = args.note.trim().slice(0, 280);
    const podCheckins = await ctx.db
      .query("checkins")
      .withIndex("by_pod", (q) => q.eq("podId", membership.podId))
      .collect();
    const existing = podCheckins.find(
      (c) => c.userId === userId && c.dayKey === args.todayKey,
    );

    if (!note) {
      // Empty note clears today's check-in instead of saving silence.
      if (existing) await ctx.db.delete(existing._id);
      return { cleared: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { note, createdAt: Date.now() });
      return { cleared: false };
    }
    await ctx.db.insert("checkins", {
      podId: membership.podId,
      userId,
      dayKey: args.todayKey,
      note,
      createdAt: Date.now(),
    });
    return { cleared: false };
  },
});
