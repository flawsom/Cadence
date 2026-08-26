import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import * as React from "react";
import { FeedbackDisplay, type Feedback } from "./FeedbackDisplay";

interface ExistingAnswer {
  _id: Id<"answers">;
  problemIndex: number;
  answer: string;
  score?: number;
  feedback?: Feedback;
  status: "submitted" | "evaluated" | "error";
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

  const existingAnswers = useQuery(api.answers.byTask, { taskId });
  const submitAnswer = useMutation(api.answers.submit);
  const evaluateAnswer = useAction(api.evaluateAnswer.evaluate);

  // Find existing answer for this specific problem
  const existing = existingAnswers?.find(
    (a) => a.problemIndex === problemIndex && a.status === "evaluated",
  );

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

      // Trigger AI evaluation
      try {
        await evaluateAnswer({
          answerId,
          problemText,
          userAnswer: answer.trim(),
          topicContext,
        });
      } catch {
        // LLM might be offline — mark error but don't break the UX
        setError("AI evaluation unavailable — your answer was saved. Try again when the LLM is running.");
      }

      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  // Show existing evaluation
  if (existing) {
    return (
      <div className="mt-2">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-chart-2" />
          <span>Your previous answer:</span>
          <span className="truncate max-w-[200px] italic">"{existing.answer}"</span>
        </div>
        {existing.feedback && (
          <FeedbackDisplay score={existing.score ?? 0} feedback={existing.feedback} />
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer here..."
        rows={3}
        className="text-sm resize-y max-h-40"
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Your answer will be evaluated by AI with professor-level feedback
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
