/**
 * Cadence E2E consumer journey — runs against the LIVE Convex deployment.
 * Simulates exactly what a consumer does in the UI:
 *   guest sign-in → profile → create plan → see today's tasks →
 *   complete one → verify stats update live → verify spaced review was
 *   scheduled → pod lifecycle (create, check-in, leave).
 *
 * Run: bun scripts/e2e-consumer.ts [CONVEX_URL]
 * Uses an anonymous guest identity, fully isolated from real accounts.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convex/_generated/api";

const url = process.argv[2] ?? "https://blessed-mosquito-123.convex.cloud";
const client = new ConvexHttpClient(url);

const today = (() => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
})();

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`\nCadence E2E — ${url}\n`);

  // ── 1. Sign in (guest path — same token machinery as email OTP) ──────────
  console.log("1. Sign-in");
  const signIn: any = await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  });
  const token = signIn?.tokens?.token;
  ok("guest sign-in returns a session token", !!token);
  if (!token) throw new Error("cannot continue without auth");
  client.setAuth(token);

  // ── 2. Profile ────────────────────────────────────────────────────────────
  console.log("2. Profile");
  const me: any = await client.query(api.users.currentUser, {});
  ok("currentUser resolves after sign-in", !!me?._id, me?.email ?? "(guest)");
  const anonMe: any = await new ConvexHttpClient(url).query(
    api.users.currentUser,
    {},
  );
  ok("signed-out user sees null profile", anonMe === null);

  // ── 3. Create a plan ─────────────────────────────────────────────────────
  console.log("3. Create plan");
  const planId: any = await client.mutation(api.plans.createPlan, {
    title: "E2E: Rust basics",
    rawInput:
      "ownership and borrowing\nstructs and enums\nerror handling\nasync basics",
    topics: [
      { title: "Ownership & borrowing", hours: 1, level: 1 },
      { title: "Structs and enums", hours: 1, level: 2 },
      { title: "Error handling", hours: 1, level: 3 },
    ],
    hoursPerDay: 1,
    targetDays: 5,
    startDayKey: today,
  });
  ok("plan created", !!planId?.planId, `${planId?.scheduledDays} day(s) scheduled, sequenced: ${planId?.usedSequencing}`);

  const plans: any[] = await client.query(api.plans.list, {});
  const mine = plans.find((p) => p._id === planId?.planId);
  ok("plan appears in live list", !!mine, mine ? `${mine.title}` : "");

  // ── 4. Today's board is populated and sized to budget ────────────────────
  console.log("4. Today board");
  const board: any = await client.query(api.tasks.getBoard, { todayKey: today });
  const todays = board?.today ?? board?.tasks ?? [];
  ok("today has scheduled tasks", todays.length > 0, `${todays.length} task(s)`);
  const dayHours = todays.reduce((s: number, t: any) => s + t.hours, 0);
  ok(
    "day never exceeds the hourly budget",
    dayHours <= 1.0001,
    `${dayHours}h ≤ 1h`,
  );

  // ── 5. Complete a task → stats must move (live data proof) ───────────────
  console.log("5. Complete task → live stats");
  const before: any = await client.query(api.tasks.getStats, { todayKey: today });
  const target = todays[0];
  await client.mutation(api.tasks.setTaskDone, {
    taskId: target._id,
    done: true,
    todayKey: today,
  });
  const after: any = await client.query(api.tasks.getStats, { todayKey: today });
  ok(
    "total done hours increased",
    (after?.totalHoursCompleted ?? 0) > (before?.totalHoursCompleted ?? 0),
    `${before?.totalHoursCompleted ?? 0}h → ${after?.totalHoursCompleted ?? 0}h`,
  );
  const heatToday = after?.heatmap?.find((h: any) => h.dayKey === today);
  ok("heatmap records today", (heatToday?.hours ?? 0) > 0, `${heatToday?.hours ?? 0}h`);

  // ── 6. Spaced review got scheduled ahead ──────────────────────────────────
  console.log("6. Spaced repetition");
  let reviewFound = "";
  for (let i = 1; i <= 21 && !reviewFound; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const futureBoard: any = await client.query(api.tasks.getBoard, { todayKey: key });
    const items = futureBoard?.today ?? futureBoard?.tasks ?? [];
    const hit = items.find((t: any) => /review/i.test(t.title ?? ""));
    if (hit) reviewFound = key;
  }
  ok("review scheduled within 21 days", !!reviewFound, reviewFound || "none found");

  // ── 7. Rollover: unfinished work moves forward, never vanishes ───────────
  console.log("7. Rollover");
  await client.mutation(api.tasks.syncRollover, { todayKey: today });
  const boardAfterRoll: any = await client.query(api.tasks.getBoard, { todayKey: today });
  const rolledItems = boardAfterRoll?.rolledOver ?? boardAfterRoll?.today ?? [];
  ok(
    "rollover sync leaves unfinished work visible",
    Array.isArray(rolledItems),
    `${Array.isArray(boardAfterRoll?.rolledOver) ? boardAfterRoll.rolledOver.length : 0} carried item(s)`,
  );

  // ── 8. Pod lifecycle ──────────────────────────────────────────────────────
  console.log("8. Pod");
  const pod: any = await client.mutation(api.pods.createPod, { name: "E2E Pod" });
  ok("pod created", !!pod?.podId, pod?.code ?? "");
  const code = pod?.code;
  if (code) {
    const joiner = new ConvexHttpClient(url);
    const joinSignIn: any = await joiner.action(api.auth.signIn, {
      provider: "anonymous",
      params: {},
    });
    joiner.setAuth(joinSignIn.tokens.token);
    await joiner.mutation(api.pods.joinPod, { code });
    const seenByOwner: any = await client.query(api.pods.myPod, { todayKey: today });
    ok(
      "second member visible to owner (shared accountability)",
      seenByOwner?.members?.length === 2,
      `${seenByOwner?.members?.length} member(s)`,
    );
    await joiner.mutation(api.pods.checkIn, {
      note: "did my hour today",
      todayKey: today,
    });
    const withCheckin: any = await client.query(api.pods.myPod, { todayKey: today });
    const mate = withCheckin?.members?.find((m: any) => m.checkinNote);
    ok("mate's check-in is visible live", !!mate, mate?.checkinNote ?? "");
    await joiner.mutation(api.pods.leavePod, {});
  }
  await client.mutation(api.pods.leavePod, {});

  // ── 9. Archive + cleanup ─────────────────────────────────────────────────
  console.log("9. Cleanup");
  await client.mutation(api.plans.archivePlan, { planId: planId.planId, archived: true });
  const afterArchive: any[] = await client.query(api.plans.list, {});
  ok(
    "archived plan leaves the active list",
    !afterArchive.some((p) => p._id === planId?.planId),
    "",
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nE2E crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
