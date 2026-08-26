import { MathText } from "@/components/MathText";
import { TaskRow } from "@/components/app/TaskRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fmtHours, prettyDate } from "@/lib/planning";
import { useQuery } from "convex/react";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router";

const LEVELS: Record<number, { label: string; className: string }> = {
  1: {
    label: "Foundations",
    className: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  },
  2: {
    label: "Core",
    className: "border-chart-3/50 bg-chart-3/15 text-[color-mix(in_oklab,var(--chart-3),black_35%)] dark:text-chart-3",
  },
  3: {
    label: "Advanced",
    className: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  },
};

export default function PlanDetailView() {
  const { planId } = useParams<{ planId: string }>();
  // Guard against malformed ids: an invalid id would make Convex throw inside
  // useQuery and crash into the error boundary instead of a friendly screen.
  const validId = !!planId && /^[a-z0-9]{32}$/.test(planId);
  const detail = useQuery(
    api.plans.detail,
    validId ? { planId: planId as Id<"plans"> } : "skip",
  );

  if (!validId) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">That plan isn&apos;t yours to see</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been removed, or the link is off.</p>
        <Link to="/dashboard/plans">
          <Button variant="outline" className="mt-5 rounded-full">Back to plans</Button>
        </Link>
      </div>
    );
  }

  if (detail === undefined) {
    return <div className="mx-auto max-w-4xl animate-pulse text-sm text-muted-foreground">Opening schedule…</div>;
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">That plan isn&apos;t yours to see</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have been removed, or the link is off.</p>
        <Link to="/dashboard/plans">
          <Button variant="outline" className="mt-5 rounded-full">Back to plans</Button>
        </Link>
      </div>
    );
  }

  const totalHours = Math.round(detail.days.reduce(
    (sum, d) => sum + d.tasks.filter((t) => t.kind === "learn").reduce((s, t) => s + t.hours, 0),
    0,
  ) * 100) / 100;
  const overflow = detail.scheduledDays > detail.targetDays;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          to="/dashboard/plans"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All plans
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">{detail.title}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{fmtHours(totalHours)} of learning</span>
              <span aria-hidden>·</span>
              <span>{detail.topics.length} topics</span>
              <span aria-hidden>·</span>
              <span>{detail.scheduledDays} days at {fmtHours(detail.hoursPerDay)}/day</span>
            </p>
          </div>
          <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5">
            {detail.sourceKind === "ai" ? (
              <>
                <span className="size-1.5 rounded-full bg-primary" /> AI-sequenced
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-chart-2" /> Built-in pacing engine
              </>
            )}
          </Badge>
        </div>
        {overflow && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-chart-3/40 bg-chart-3/10 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-chart-3" />
            <p>
              This needs <strong>{detail.scheduledDays} days</strong> — {detail.scheduledDays - detail.targetDays}{" "}
              more than your {detail.targetDays}-day target. That&apos;s the honest cost of your hours; raise the
              daily budget or let it run long.
            </p>
          </div>
        )}
      </header>

      {/* Topic sequence */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">The order of things</h2>
        <ol className="flex flex-col gap-2">
          {detail.topics.map((topic, i) => (
            <li
              key={topic._id}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3"
            >
              <span className="w-5 shrink-0 text-right font-display text-sm font-semibold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                <MathText text={topic.title} />
              </span>
              <Badge variant="outline" className={`shrink-0 ${LEVELS[topic.level]?.className ?? ""}`}>
                {LEVELS[topic.level]?.label}
              </Badge>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtHours(topic.hours)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Day-by-day schedule */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Day by day</h2>
        <div className="flex flex-col gap-4">
          {detail.days.map((day, idx) => (
            <div key={day.dayKey} className="rounded-3xl border border-border/60 bg-card p-4">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h3 className="text-sm font-semibold">
                  Day {idx + 1}
                  <span className="ml-2 font-normal text-muted-foreground">{prettyDate(day.dayKey)}</span>
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtHours(day.tasks.reduce((s, t) => s + t.hours, 0))}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {day.tasks.map((t) => (
                  <TaskRow key={t._id} task={t} accent={detail.accent} todayKey={day.dayKey} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
