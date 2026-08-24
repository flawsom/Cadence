import { NewPlanDialog } from "@/components/app/NewPlanDialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { fmtHours, prettyDate } from "@/lib/planning";
import { useQuery } from "convex/react";
import { Library, Plus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

export default function PlansView() {
  const plans = useQuery(api.plans.list);
  const [params, setParams] = useSearchParams();
  const dialogOpen = params.get("new") === "1";

  useEffect(() => {
    if (!plans) return;
    if (dialogOpen && plans.length === 0) return; // dialog stays open via its own state
  }, [dialogOpen, plans]);

  function closeDialog(open: boolean) {
    if (!open) {
      params.delete("new");
      setParams(params, { replace: true });
    }
  }

  const loading = plans === undefined;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Several subjects at once? Each gets its own pace — Cadence keeps them from colliding.
          </p>
        </div>
        <NewPlanDialog
          open={dialogOpen}
          onOpenChange={closeDialog}
          trigger={
            <Button className="gap-2 rounded-full shadow-pop-sm" onClick={() => !dialogOpen && undefined}>
              <Plus className="size-4" /> New plan
            </Button>
          }
        />
      </header>

      {loading ? (
        <div className="animate-pulse text-sm text-muted-foreground">Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Library className="mx-auto size-8 text-muted-foreground/60" />
          <h2 className="mt-3 font-display text-xl font-semibold">No plans yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A certification blueprint, a course handout, or a two-line confession like
            &ldquo;I want to learn Rust&rdquo; — they all work. Paste it in and pick your hours.
          </p>
          <NewPlanDialog
            trigger={
              <Button className="mt-5 gap-2 rounded-full shadow-pop-sm">
                <Sparkles className="size-4" /> Create your first plan
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const pct = plan.totalCount > 0 ? Math.round((plan.doneCount / plan.totalCount) * 100) : 0;
            const overflow = plan.scheduledDays > plan.targetDays;
            return (
              <Link
                key={plan._id}
                to={`/dashboard/plans/${plan._id}`}
                className="group rounded-3xl border border-border/70 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-snug">{plan.title}</h3>
                  <span
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: plan.accent }}
                    aria-hidden
                  />
                </div>

                {/* Progress */}
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: plan.accent }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {pct}% complete · {plan.totalTopics} topics · {fmtHours(plan.openLearnHours)} of learning left
                </p>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{fmtHours(plan.hoursPerDay)}/day budget</span>
                  <span>
                    {plan.scheduledDays} days{overflow ? ` · runs ${plan.scheduledDays - plan.targetDays} past target` : ""}
                  </span>
                </div>
                {overflow && (
                  <p className="mt-2 text-[11px] font-medium text-chart-3">
                    Honest math: it needs more days than you asked for.
                  </p>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground/70">
                  Started {prettyDate(new Date(plan.createdAt).toISOString().slice(0, 10))}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
