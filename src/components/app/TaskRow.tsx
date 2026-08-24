import { MathText } from "@/components/MathText";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { fmtHours } from "@/lib/planning";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { BookOpen, RotateCcw, Repeat2 } from "lucide-react";

export interface TaskRowData {
  _id: Id<"tasks">;
  title: string;
  kind: "learn" | "review";
  hours: number;
  status: "open" | "done";
  carried?: boolean;
  reviewStage?: number;
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

  return (
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
      <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {fmtHours(task.hours)}
      </span>
    </label>
  );
}
