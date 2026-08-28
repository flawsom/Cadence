import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fmtHours, prettyDate } from "@/lib/planning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpenCheck,
  Clock,
  Filter,
  MessageSquare,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { FeedbackDisplay, type Feedback } from "./FeedbackDisplay";
import * as React from "react";

interface AnswerRow {
  _id: Id<"answers">;
  taskId: Id<"tasks">;
  planId: Id<"plans">;
  problemIndex: number;
  problemText: string;
  score?: number;
  status: "submitted" | "evaluated" | "error";
  createdAt: number;
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-chart-2/15 text-chart-2 border-chart-2/30"
      : score >= 60
        ? "bg-chart-3/15 text-chart-3 border-chart-3/30"
        : score >= 40
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      <Trophy className="size-3" />
      {score}
    </span>
  );
}

function AnswerCard({ answer }: { answer: AnswerRow }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/70 bg-card transition-colors hover:border-border"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {answer.problemIndex === -1 ? (
              <Badge variant="outline" className="gap-1 border-chart-4/50 text-[10px] uppercase tracking-wide text-chart-4">
                Challenge
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wide">
                Problem {answer.problemIndex + 1}
              </Badge>
            )}
            {answer.score !== undefined && <ScorePill score={answer.score} />}
            {answer.status === "submitted" && (
              <Badge variant="secondary" className="text-[10px]">
                Evaluating…
              </Badge>
            )}
            {answer.status === "error" && (
              <Badge variant="destructive" className="text-[10px]">
                Error
              </Badge>
            )}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {answer.problemText}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {prettyDate(new Date(answer.createdAt).toISOString().slice(0, 10))}
            </span>
          </div>
        </div>
        <MessageSquare className="mt-1 size-4 shrink-0 text-muted-foreground/40" />
      </button>

      {expanded && answer.status === "evaluated" && (
        <div className="border-t border-border/50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Your answer:</p>
          <p className="text-sm leading-relaxed text-muted-foreground/80">{answer.problemText}</p>
        </div>
      )}
    </motion.div>
  );
}

export default function AnswerHistoryView() {
  const answers = useQuery(api.answers.userHistory);
  const [filterPlan, setFilterPlan] = useState<string | null>(null);

  // Gather unique plan IDs for filter dropdown
  const planIds = useMemo(() => {
    if (!answers) return [];
    const ids = new Set(answers.map((a) => a.planId));
    return [...ids];
  }, [answers]);

  const filtered = useMemo(() => {
    if (!answers) return [];
    if (!filterPlan) return answers;
    return answers.filter((a) => a.planId === filterPlan);
  }, [answers, filterPlan]);

  const avgScore = useMemo(() => {
    if (!filtered) return 0;
    const scored = filtered.filter((a) => a.score !== undefined);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length);
  }, [filtered]);

  const totalAnswered = filtered?.length ?? 0;
  const evaluated = filtered?.filter((a) => a.status === "evaluated").length ?? 0;

  if (!answers) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse text-sm text-muted-foreground">
        Loading answer history…
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon-sm" className="rounded-full">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Answer History
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse your past submissions and evaluations
          </p>
        </div>
      </header>

      {/* Stats summary */}
      <section className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <BookOpenCheck className="size-5 text-primary" />
          <div>
            <p className="text-lg font-bold tabular-nums">{totalAnswered}</p>
            <p className="text-xs text-muted-foreground">Submitted</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <Trophy className="size-5 text-chart-2" />
          <div>
            <p className="text-lg font-bold tabular-nums">{avgScore}</p>
            <p className="text-xs text-muted-foreground">Avg score</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
          <MessageSquare className="size-5 text-chart-3" />
          <div>
            <p className="text-lg font-bold tabular-nums">{evaluated}</p>
            <p className="text-xs text-muted-foreground">Evaluated</p>
          </div>
        </div>
      </section>

      {/* Filter */}
      {planIds.length > 1 && (
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterPlan(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !filterPlan
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/70 text-muted-foreground hover:border-primary/40"
              }`}
            >
              All
            </button>
            {planIds.map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => setFilterPlan(pid)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterPlan === pid
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/70 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {pid.slice(0, 8)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Answer list */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <BookOpenCheck className="mx-auto size-8 text-muted-foreground/60" />
          <h2 className="mt-3 font-display text-xl font-semibold">No answers yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Complete practice problems in your tasks to see your answer history here.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" className="mt-4 gap-2 rounded-full">
              Go to dashboard
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((answer) => (
            <AnswerCard key={answer._id} answer={answer} />
          ))}
        </div>
      )}
    </div>
  );
}
