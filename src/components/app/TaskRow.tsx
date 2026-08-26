import { MathText } from "@/components/MathText";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { fmtHours } from "@/lib/planning";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Flame,
  PencilRuler,
  RotateCcw,
  Repeat2,
} from "lucide-react";
import * as React from "react";

export interface TaskRowData {
  _id: Id<"tasks">;
  title: string;
  kind: "learn" | "review" | "practice" | "challenge";
  hours: number;
  status: "open" | "done";
  carried?: boolean;
  reviewStage?: number;
  practiceProblems?: string[];
  challengeProblem?: string;
}

export function TaskRow({
  task,
  accent,
  todayKey,
}: {
  task: TaskRowData;
  accent?: string;
  todayKey: string;
}) {
  const setTaskDone = useMutation(api.tasks.setTaskDone);
  const done = task.status === "done";
  const hasProblems =
    (task.practiceProblems?.length ?? 0) > 0 || !!task.challengeProblem;
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="flex flex-col">
      <label
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all",
          done
            ? "border-border/50 bg-muted/40"
            : "border-border/70 bg-card hover:border-primary/40 hover:shadow-pop-sm",
        )}
      >
        <Checkbox
          checked={done}
          onCheckedChange={(checked) =>
            void setTaskDone({ taskId: task._id, done: checked === true, todayKey })
          }
          className="mt-0.5"
          aria-label={`Mark ${task.title} ${done ? "not done" : "done"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {accent && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
            )}
            <MathText
              className={cn(
                "text-sm font-medium leading-snug",
                done && "text-muted-foreground line-through decoration-primary/40",
              )}
              text={task.title}
            />
            {task.kind === "review" && (
              <Badge variant="outline" className="gap-1 border-chart-2/50 text-[10px] uppercase tracking-wide text-chart-2">
                <Repeat2 className="size-3" /> Review
              </Badge>
            )}
            {task.carried && !done && (
              <Badge className="gap-1 bg-secondary text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
                <RotateCcw className="size-3" /> Rolled over
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasProblems && !done && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                expanded
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary",
              )}
              aria-label="Show practice problems"
            >
              <PencilRuler className="size-3" />
              Practice
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          )}
          <span className="pt-0.5 text-xs tabular-nums text-muted-foreground">
            {fmtHours(task.hours)}
          </span>
        </div>
      </label>

      {/* Expandable practice problems + challenge */}
      <AnimatePresence>
        {expanded && hasProblems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-8 mt-1 flex flex-col gap-2 rounded-2xl border border-dashed border-border/50 bg-muted/30 px-4 py-3">
              {task.practiceProblems && task.practiceProblems.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    <PencilRuler className="size-3" /> Practice problems
                  </p>
                  <ol className="list-decimal space-y-1 pl-4">
                    {task.practiceProblems.map((p, i) => (
                      <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                        {p}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {task.challengeProblem && (
                <div className="mt-1 rounded-xl border border-chart-4/30 bg-chart-4/5 px-3 py-2">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-chart-4">
                    <Flame className="size-3" /> Master challenge
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {task.challengeProblem}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
