import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  PencilRuler,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { FeedbackDisplay, type Feedback } from "./FeedbackDisplay";

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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${color}`}>
      <Trophy className="size-2.5" />
      {score}
    </span>
  );
}

export function AnswerForm({
  taskId,
  planId,
  problemIndex,
  problemText,
  topicContext,
}: {
  taskId: Id<"tasks">;
  planId: Id<"plans">;
  problemIndex: number;
  problemText: string;
  topicContext?: string;
}) {
  const [answer, setAnswer] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  const history = useQuery(api.answers.byTaskAndProblem, { taskId, problemIndex });
  const submitAnswer = useMutation(api.answers.submit);
  const evaluateAnswer = useAction(api.evaluateAnswer.evaluate);

  // Latest evaluated answer
  const latestEvaluated = history?.filter((a) => a.status === "evaluated").pop();
  // Best answer by score
  const bestAnswer = history?.filter((a) => a.score !== undefined).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  // Count of attempts
  const attemptCount = history?.length ?? 0;

  async function handleSubmit() {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { answerId } = await submitAnswer({
        taskId,
        planId,
        problemIndex,
        problemText,
        answer: answer.trim(),
      });

      await evaluateAnswer({
        answerId,
        problemText,
        userAnswer: answer.trim(),
        topicContext,
      });

      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  // If we have previous answers, show the history + comparison view
  if (history && history.length > 0) {
    return (
      <div className="mt-2 flex flex-col gap-3">
        {/* Score comparison bar */}
        {history.length >= 2 && (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <Trophy className="size-3.5 text-chart-3 shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground">Progress:</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {history.map((a, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  {a.score !== undefined ? (
                    <ScorePill score={a.score} />
                  ) : (
                    <span className="text-muted-foreground italic">pending</span>
                  )}
                </span>
              ))}
            </div>
            {bestAnswer && bestAnswer !== latestEvaluated && (
              <Badge variant="outline" className="ml-auto border-chart-2/50 text-[10px] text-chart-2">
                Best: {bestAnswer.score}
              </Badge>
            )}
          </div>
        )}

        {/* Show latest feedback */}
        {latestEvaluated?.feedback && (
          <FeedbackDisplay score={latestEvaluated.score ?? 0} feedback={latestEvaluated.feedback} />
        )}

        {/* Submission history toggle */}
        {history.length > 1 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <History className="size-3" />
            {showHistory ? "Hide" : "Show"} all {history.length} attempts
            {showHistory ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}

        {/* History comparison view */}
        <AnimatePresence>
          {showHistory && history.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid gap-3">
                {history.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 ${
                      a === bestAnswer
                        ? "border-chart-2/40 bg-chart-2/5"
                        : "border-border/50 bg-muted/10"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Attempt #{i + 1}
                        </span>
                        {a.score !== undefined && <ScorePill score={a.score} />}
                        {a === bestAnswer && history.length > 1 && (
                          <Badge className="bg-chart-2/15 text-[10px] text-chart-2">Best</Badge>
                        )}
                      </div>
                      {a.evaluatedAt && (
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(a.evaluatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground italic">
                      &ldquo;{a.answer.length > 200 ? a.answer.slice(0, 200) + "..." : a.answer}&rdquo;
                    </p>
                    {a.feedback && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {a.feedback.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New answer form — always available for improvement */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <PencilRuler className="size-3 text-primary" />
            {attemptCount > 0 ? "Try again to improve your score:" : "Write your answer:"}
          </p>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={attemptCount > 0 ? "Write an improved answer..." : "Write your answer here..."}
            rows={3}
            className="text-sm resize-y max-h-40"
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          <div className="mt-2 flex items-center justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !answer.trim()}
              className="gap-1.5 rounded-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Evaluating…
                </>
              ) : (
                <>
                  <Send className="size-3" /> Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // First-time: no answers yet — clean form
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer here..."
        rows={3}
        className="text-sm resize-y max-h-40"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Your answer will be evaluated with professor-level feedback
        </p>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !answer.trim()}
          className="gap-1.5 rounded-full"
        >
          {submitting ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Evaluating…
            </>
          ) : (
            <>
              <Send className="size-3" /> Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
