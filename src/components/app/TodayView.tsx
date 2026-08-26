import { Heatmap } from "@/components/app/Heatmap";
import { ReviewTodayCard } from "@/components/app/ReviewTodayCard";
import { TrendChart } from "@/components/app/TrendChart";
import { TaskRow } from "@/components/app/TaskRow";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { fmtHours, longDate, todayISO } from "@/lib/planning";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarCheck2,
  Flame,
  Repeat2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const ACCENTS = ["#E85A2A", "#2A9D8F", "#E9B44C", "#7B6CF0", "#DB2763"];

export default function TodayView() {
  const { user } = useAuth();
  const todayKey = todayISO();
  const board = useQuery(api.tasks.getBoard, { todayKey });
  const stats = useQuery(api.tasks.getStats, { todayKey });
  const syncRollover = useMutation(api.tasks.syncRollover);
  const syncedDay = useRef<string | null>(null);
  const [progressView, setProgressView] = useState<"heatmap" | "trend">("heatmap");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Roll unfinished work forward once per day, then surface it honestly.
  useEffect(() => {
    if (!board || syncedDay.current === todayKey) return;
    syncedDay.current = todayKey;
    syncRollover({ todayKey })
      .then(({ moved }) => {
        if (moved > 0) {
          toast(`${moved} task${moved === 1 ? "" : "s"} rolled forward`, {
            description: "Nothing disappears here — it just moves to today.",
          });
        }
      })
      .catch(() => undefined);
  }, [board, todayKey, syncRollover]);

  const grouped = useMemo(() => {
    if (!board) return [];
    const map = new Map<string, typeof board.tasks>();
    for (const t of board.tasks) {
      const list = map.get(t.planTitle) ?? [];
      list.push(t);
      map.set(t.planTitle, list);
    }
    return [...map.entries()];
  }, [board]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (!board || !stats) {
    return <div className="mx-auto max-w-3xl animate-pulse text-sm text-muted-foreground">Setting your pace…</div>;
  }

  const doneCount = board.tasks.filter((t) => t.status === "done").length;
  const allDone = board.tasks.length > 0 && doneCount === board.tasks.length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {longDate(todayKey)}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {greeting}
            {user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </h1>
        </div>
        <Link to="/dashboard/plans?new=1">
          <Button className="gap-2 rounded-full shadow-pop-sm">
            <Sparkles className="size-4" /> New plan
          </Button>
        </Link>
      </header>

      {/* Live stats */}
      <section className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium">
          <Flame className="size-3.5 text-chart-1" />
          {stats.streak > 0 ? (
            <>
              <span className="text-base leading-none">🔥</span>
              <span>{stats.streak}-day streak</span>
              {stats.longestStreak > stats.streak && (
                <span className="text-muted-foreground">· best: {stats.longestStreak}</span>
              )}
            </>
          ) : (
            <span>Start your streak today</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium">
          <Repeat2 className="size-3.5 text-chart-2" />
          {stats.reviewsDueToday > 0
            ? `${stats.reviewsDueToday} review${stats.reviewsDueToday === 1 ? "" : "s"} due`
            : "No reviews due"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium tabular-nums">
          <CalendarCheck2 className="size-3.5 text-chart-4" />
          {fmtHours(stats.totalHoursCompleted)} learned for keeps
        </span>
      </section>

      {/* Review Today — prominent card for spaced repetition */}
      {board.tasks.filter((t) => t.kind === "review" && t.status === "open").length > 0 && (
        <ReviewTodayCard
          reviews={board.tasks
            .filter((t) => t.kind === "review" && t.status === "open")
            .map((t) => ({
              _id: t._id,
              title: t.title,
              hours: t.hours,
              reviewStage: t.reviewStage,
              planTitle: t.planTitle,
              planAccent: t.planAccent,
            }))}
          onReviewAll={() => {
            // Scroll to the first review task in the board
            const firstReview = document.querySelector('[data-kind="review"]');
            firstReview?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

      {/* Progress: interactive heatmap + trend line, switchable */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="px-1 text-sm font-semibold">Your last 17 weeks</h2>
          <div
            className="flex rounded-full border border-border/70 bg-card p-0.5"
            role="tablist"
            aria-label="Progress view"
          >
            {(
              [
                ["heatmap", "Squares"],
                ["trend", "Trend"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={progressView === key}
                onClick={() => setProgressView(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  progressView === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {progressView === "heatmap" ? (
          <Heatmap
            heatmap={stats.heatmap}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <TrendChart data={stats.heatmap} />
        )}
      </section>

      {/* Rollover banner */}
      {board.carriedCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-secondary bg-secondary/60 px-4 py-3 text-sm">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-secondary-foreground" />
          <p>
            <span className="font-semibold">{board.carriedCount} rolled forward.</span>{" "}
            <span className="text-muted-foreground">
              Yesterday&apos;s leftovers are first in line today.
            </span>
          </p>
        </div>
      )}

      {/* Board */}
      {board.tasks.length === 0 ? (
        <EmptyBoard hasPlans={board.activePlans.length > 0} />
      ) : (
        <section className="flex flex-col gap-6">
          {grouped.map(([planTitle, tasks]) => (
            <div key={planTitle}>
              <h2 className="mb-2 px-1 text-sm font-semibold">{planTitle}</h2>
              <div className="flex flex-col gap-2">
                {tasks.map((t) => (
                  <TaskRow key={t._id} task={t} accent={ACCENTS[t.planAccent] ?? ACCENTS[0]!} todayKey={todayKey} />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {fmtHours(board.doneHours)} of {fmtHours(board.plannedHours)} done
            </span>
            {allDone ? (
              <span className="font-medium text-primary">Day complete. Go live your life.</span>
            ) : (
              <span className="tabular-nums text-muted-foreground">
                {doneCount}/{board.tasks.length} checked off
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyBoard({ hasPlans }: { hasPlans: boolean }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <CalendarCheck2 className="mx-auto size-8 text-muted-foreground/60" />
      {hasPlans ? (
        <>
          <h2 className="mt-3 font-display text-xl font-semibold">Nothing scheduled today</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Your plans have more to give. Check a plan&apos;s schedule to pull the next session forward.
          </p>
          <Link to="/dashboard/plans">
            <Button variant="outline" className="mt-4 gap-2 rounded-full">
              View plans <ArrowRight className="size-4" />
            </Button>
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-3 font-display text-xl font-semibold">Your syllabus called. It wants a schedule.</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Paste a course outline — or just name what you want to learn — and Cadence will size it to your days.
          </p>
          <Link to="/dashboard/plans?new=1">
            <Button className="mt-4 gap-2 rounded-full shadow-pop-sm">
              Create your first plan <ArrowRight className="size-4" />
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
