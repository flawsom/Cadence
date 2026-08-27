import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove

      // Cadence: timestamp of the welcome email (null = not yet sent).
      welcomeSentAt: v.optional(v.number()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ── Cadence ────────────────────────────────────────────────────────────

    // A learning track: one syllabus turned into a day-by-day schedule.
    plans: defineTable({
      userId: v.id("users"),
      title: v.string(),
      sourceExcerpt: v.string(),
      sourceKind: v.union(v.literal("ai"), v.literal("heuristic")),
      hoursPerDay: v.number(),
      targetDays: v.number(),
      scheduledDays: v.number(),
      status: v.union(v.literal("active"), v.literal("archived")),
      accent: v.number(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Sequenced topics for a plan, fundamentals-first.
    topics: defineTable({
      planId: v.id("plans"),
      idx: v.number(),
      title: v.string(),
      hours: v.number(),
      level: v.number(), // 1 foundations · 2 core · 3 advanced
    }).index("by_plan", ["planId"]),

    // One schedulable block of work: a learning chunk or a retention review.
    tasks: defineTable({
      userId: v.id("users"),
      planId: v.id("plans"),
      topicId: v.optional(v.id("topics")),
      title: v.string(),
      kind: v.union(v.literal("learn"), v.literal("review"), v.literal("practice"), v.literal("challenge")),
      practiceProblems: v.optional(v.array(v.string())),
      challengeProblem: v.optional(v.string()),
      hours: v.number(),
      dayKey: v.string(), // YYYY-MM-DD (client-local)
      dayIndex: v.number(),
      order: v.number(),
      status: v.union(v.literal("open"), v.literal("done")),
      doneAt: v.optional(v.number()),
      doneDayKey: v.optional(v.string()),
      carried: v.boolean(),
      reviewStage: v.optional(v.number()),
      reviewSpawned: v.boolean(),
      createdAt: v.number(),
    })
      .index("by_user_day", ["userId", "dayKey"])
      .index("by_user", ["userId"])
      .index("by_plan", ["planId"]),

    // A small group studying alongside each other.
    pods: defineTable({
      name: v.string(),
      code: v.string(),
      ownerId: v.id("users"),
      createdAt: v.number(),
    }).index("by_code", ["code"]),

    podMembers: defineTable({
      podId: v.id("pods"),
      userId: v.id("users"),
      joinedAt: v.number(),
    })
      .index("by_pod", ["podId"])
      .index("by_user", ["userId"]),

    // A user's answer to a practice problem or challenge.
    answers: defineTable({
      userId: v.id("users"),
      taskId: v.id("tasks"),
      planId: v.id("plans"),
      problemIndex: v.number(), // 0-based for practice, -1 for challenge
      problemText: v.string(), // the original problem statement
      answer: v.string(), // user's submitted answer
      score: v.optional(v.number()), // 0-100
      feedback: v.optional(
        v.object({
          summary: v.string(),
          strengths: v.array(v.string()),
          weaknesses: v.array(v.string()),
          improvedAnswer: v.optional(v.string()),
          explanation: v.string(), // professor-level detailed explanation
          diagram: v.optional(v.string()), // mermaid diagram or SVG
          equations: v.optional(v.array(v.string())), // LaTeX equations
        }),
      ),
      status: v.union(v.literal("submitted"), v.literal("evaluated"), v.literal("error")),
      createdAt: v.number(),
      evaluatedAt: v.optional(v.number()),
    })
      .index("by_user", ["userId"])
      .index("by_task", ["taskId"]),

    // A daily check-in note inside a pod (one per member per day).
    checkins: defineTable({
      podId: v.id("pods"),
      userId: v.id("users"),
      dayKey: v.string(),
      mood: v.optional(
        v.union(v.literal("great"), v.literal("okay"), v.literal("rough")),
      ),
      note: v.string(),
      createdAt: v.number(),
    }).index("by_pod", ["podId"]),

    // Web push notification subscriptions (one row per device).
    pushSubscriptions: defineTable({
      userId: v.id("users"),
      endpoint: v.string(),
      p256dh: v.string(),
      auth: v.string(),
      userAgent: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"]).index("by_endpoint", ["endpoint"])
,

    // Daily pod activity digest — generated by cron every day.
    podDigests: defineTable({
      podId: v.id("pods"),
      weekEnding: v.string(),
      memberStats: v.array(
        v.object({
          name: v.string(),
          weeklyHours: v.number(),
          totalDone: v.number(),
          totalTasks: v.number(),
          planCount: v.number(),
        }),
      ),
      totalPodHours: v.number(),
      topPerformerName: v.string(),
      createdAt: v.number(),
    }).index("by_pod", ["podId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
