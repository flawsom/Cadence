import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { todayISO, addDays, diffDays } from "@/lib/planning";
import { AlertTriangle, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Spaced repetition retention model (Ebbinghaus-inspired).
 * Each review stage strengthens memory: retention = 1 - decay ^ stage.
 * After a review is completed, the decay resets. Topics with reviewStage
 * approaching their next gap threshold get flagged.
 */
const REVIEW_GAPS_DAYS = [1, 3, 7, 21];

function retentionProbability(
  daysSinceLastReview: number,
  stage: number,
): number {
  // Higher stages = stronger memory, slower decay
  const strength = 0.3 + stage * 0.15; // 0.3 (stage 1) → 0.75 (stage 4)
  return Math.max(0, 1 - Math.exp(-strength / (daysSinceLastReview + 0.5)));
}

function urgencyColor(retention: number): string {
  if (retention < 0.3) return "text-red-500 bg-red-500/10 border-red-500/30";
  if (retention < 0.5) return "text-orange-500 bg-orange-500/10 border-orange-500/30";
  if (retention < 0.7) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
  return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
}

function urgencyLabel(retention: number): string {
  if (retention < 0.3) return "Critical";
  if (retention < 0.5) return "Fading";
  if (retention < 0.7) return "Getting weak";
  return "Holding steady";
}

/** Mini SVG curve for a single topic showing decay over the next 14 days. */
function MiniCurve({
  retentionNow,
  stage,
  accent,
}: {
  retentionNow: number;
  stage: number;
  accent: string;
}) {
  const points = useMemo(() => {
    const pts: string[] = [];
    for (let d = 0; d <= 14; d++) {
      const r = retentionProbability(d + 1, stage);
      pts.push(`${(d / 14) * 100},${(1 - r) * 100}`);
    }
    return pts.join(" ");
  }, [stage]);

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-8 w-16 shrink-0"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Current position dot */}
      <circle
        cx={0}
        cy={(1 - retentionNow) * 100}
        r="3"
        fill={accent}
        opacity="1"
      />
    </svg>
  );
}

export function ForgettingCurve({ accent }: { accent?: string }) {
  const todayKey = todayISO();
  const schedule = useQuery(api.tasks.getReviewSchedule, {
    todayKey,
    lookaheadDays: 30,
  });

  const items = useMemo(() => {
    if (!schedule) return [];
    return schedule.reviews
      .map((r) => {
        const daysAway = diffDays(todayKey, r.dayKey);
        const daysSinceLearned = (r.learnedDaysAgo ?? 0) + daysAway;
        const retention = retentionProbability(
          daysSinceLearned,
          r.reviewStage ?? 1,
        );
        return {
          ...r,
          retention,
          daysAway,
        };
      })
      .sort((a, b) => a.retention - b.retention) // worst first
      .slice(0, 8);
  }, [schedule, todayKey]);

  if (!schedule || items.length === 0) return null;

  const atRisk = items.filter((i) => i.retention < 0.5).length;
  const todayKeyItems = items.filter((i) => i.daysAway === 0);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Memory Decay</h3>
          </div>
          {atRisk > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
              <AlertTriangle className="size-3" />
              {atRisk} fading
            </span>
          )}
        </div>
        {todayKeyItems.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {todayKeyItems.length} due now
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item.taskId}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 transition-all",
              item.daysAway === 0 && item.retention < 0.5
                ? "border-red-500/30 bg-red-500/5"
                : "border-border/50 bg-muted/30",
            )}
          >
            <MiniCurve
              retentionNow={item.retention}
              stage={item.reviewStage ?? 1}
              accent={accent ?? "#E85A2A"}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium leading-tight">
                {item.title}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    urgencyColor(item.retention),
                  )}
                >
                  {urgencyLabel(item.retention)}
                </span>
                {item.daysAway === 0 ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-primary">
                    <Clock className="size-2.5" /> Due today
                  </span>
                ) : item.daysAway > 0 ? (
                  <span className="text-[9px] text-muted-foreground">
                    in {item.daysAway}d
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground">
                    {Math.abs(item.daysAway)}d overdue
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold tabular-nums">
                {Math.round(item.retention * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
