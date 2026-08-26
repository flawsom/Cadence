import { Button } from "@/components/ui/button";
import { Repeat2, ChevronRight, Brain, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewTask {
  _id: string;
  title: string;
  hours: number;
  reviewStage?: number;
  planTitle: string;
  planAccent: number;
}

const ACCENTS = ["#E85A2A", "#2A9D8F", "#E9B44C", "#7B6CF0", "#DB2763"];

const STAGE_LABELS = [
  "1st review",
  "2nd review",
  "3rd review",
  "4th review",
  "5th review",
  "Final review",
];

const STAGE_ICONS = [Brain, Brain, Zap, Zap, Zap, Zap];

export function ReviewTodayCard({
  reviews,
  onReviewAll,
}: {
  reviews: ReviewTask[];
  onReviewAll?: () => void;
}) {
  if (reviews.length === 0) return null;

  const accent = ACCENTS[reviews[0]?.planAccent ?? 0] ?? ACCENTS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-card/80 p-5 shadow-lg"
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-15 blur-3xl"
        style={{ background: accent }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accent}18` }}
          >
            <Repeat2 className="size-5" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold">
              {reviews.length === 1
                ? "1 topic due for review"
                : `${reviews.length} topics due for review`}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Spaced repetition keeps what you&apos;ve learned alive
            </p>
          </div>
        </div>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {reviews.length}
        </span>
      </div>

      {/* Review items */}
      <div className="relative mt-4 flex flex-col gap-2">
        <AnimatePresence>
          {reviews.map((review, i) => {
            const stageIdx = (review.reviewStage ?? 1) - 1;
            const StageIcon = STAGE_ICONS[Math.min(stageIdx, STAGE_ICONS.length - 1)] ?? Brain;
            const stageLabel =
              STAGE_LABELS[Math.min(stageIdx, STAGE_LABELS.length - 1)] ?? "Review";

            return (
              <motion.div
                key={review._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="group flex items-center gap-3 rounded-2xl border border-border/40 bg-background/50 px-4 py-3 transition-colors hover:border-border hover:bg-background/80"
              >
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${accent}12` }}
                >
                  <StageIcon className="size-4" style={{ color: accent }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {review.title.replace(/^Review:\s*/, "")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stageLabel} · {review.planTitle}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Action */}
      <div className="relative mt-4">
        <Button
          onClick={onReviewAll}
          className="w-full gap-2 rounded-2xl"
          style={{ backgroundColor: accent }}
        >
          <Brain className="size-4" />
          Start reviewing
        </Button>
      </div>
    </motion.div>
  );
}
