import { v } from "convex/values";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function myMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"podMembers"> | undefined> {
  const memberships = await ctx.db
    .query("podMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return memberships[0];
}

export const myPod = query({
  args: { todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await myMembership(ctx, userId);
    if (!membership) return null;

    const pod = await ctx.db.get(membership.podId);
    if (!pod) return null;

    const [members, checkins] = await Promise.all([
      ctx.db
        .query("podMembers")
        .withIndex("by_pod", (q) => q.eq("podId", pod._id))
        .collect(),
      ctx.db
        .query("checkins")
        .withIndex("by_pod", (q) => q.eq("podId", pod._id))
        .collect(),
    ]);

    // Ordered by join date — a crew, not a leaderboard.
    members.sort((a, b) => a.joinedAt - b.joinedAt);

    const memberCards = await Promise.all(
      members.map(async (m) => {
        const [user, dayTasks] = await Promise.all([
          ctx.db.get(m.userId),
          ctx.db
            .query("tasks")
            .withIndex("by_user_day", (q) =>
              q.eq("userId", m.userId).eq("dayKey", args.todayKey),
            )
            .collect(),
        ]);
        const done = dayTasks.filter((t) => t.status === "done");
        const todaysCheckin = checkins.find(
          (c) => c.userId === m.userId && c.dayKey === args.todayKey,
        );
        return {
          userId: m.userId,
          name:
            user?.name ??
            user?.email?.split("@")[0] ??
            "Anonymous cadencer",
          isYou: m.userId === userId,
          joinedAt: m.joinedAt,
          doneCount: done.length,
          totalCount: dayTasks.length,
          doneHours:
            Math.round(done.reduce((s, t) => s + t.hours, 0) * 4) / 4,
          plannedHours:
            Math.round(dayTasks.reduce((s, t) => s + t.hours, 0) * 4) / 4,
          checkinNote: todaysCheckin?.note,
          checkinAt: todaysCheckin?.createdAt,
        };
      }),
    );

    return {
      _id: pod._id,
      name: pod.name,
      code: pod.code,
      ownerId: pod.ownerId,
      members: memberCards,
      todayCheckins: checkins.filter((c) => c.dayKey === args.todayKey).length,
    };
  },
});

export const createPod = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const existing = await myMembership(ctx, userId);
    if (existing) return { podId: existing.podId, created: false };

    let code = makeCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await ctx.db
        .query("pods")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash) break;
      code = makeCode();
    }

    const podId = await ctx.db.insert("pods", {
      name: args.name.trim().slice(0, 60) || "Study pod",
      code,
      ownerId: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("podMembers", { podId, userId, joinedAt: Date.now() });
    return { podId, created: true };
  },
});

export const joinPod = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const existing = await myMembership(ctx, userId);
    if (existing) throw new Error("You're already in a pod");

    const code = args.code.trim().toUpperCase();
    const pod = await ctx.db
      .query("pods")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!pod) throw new Error("No pod found with that code");

    await ctx.db.insert("podMembers", { podId: pod._id, userId, joinedAt: Date.now() });
    return { podId: pod._id, name: pod.name };
  },
});

export const checkIn = mutation({
  args: { note: v.string(), todayKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");

    const membership = await myMembership(ctx, userId);
    if (!membership) throw new Error("Join or create a pod first");

    const all = await ctx.db
      .query("checkins")
      .withIndex("by_pod", (q) => q.eq("podId", membership.podId))
      .collect();
    const existing = all.find(
      (c) => c.userId === userId && c.dayKey === args.todayKey,
    );
    const note = args.note.trim().slice(0, 280);

    if (existing) {
      if (note) {
        await ctx.db.patch(existing._id, { note, createdAt: Date.now() });
      } else {
        await ctx.db.delete(existing._id);
      }
      return { updated: true };
    }
    await ctx.db.insert("checkins", {
      podId: membership.podId,
      userId,
      dayKey: args.todayKey,
      note,
      createdAt: Date.now(),
    });
    return { updated: false };
  },
});
