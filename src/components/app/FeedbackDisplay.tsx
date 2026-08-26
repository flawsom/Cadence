import { MathText } from "@/components/MathText";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BookOpenCheck,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

export interface Feedback {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvedAnswer?: string;
  explanation: string;
  diagram?: string;
  equations?: string[];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-chart-2"
      : score >= 60
        ? "text-chart-3"
        : score >= 40
          ? "text-primary"
          : "text-destructive";
  const bgColor =
    score >= 80
      ? "stroke-chart-2/20"
      : score >= 60
        ? "stroke-chart-3/20"
        : score >= 40
          ? "stroke-primary/20"
          : "stroke-destructive/20";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={76} height={76} className="-rotate-90">
        <circle cx={38} cy={38} r={radius} fill="none" className={bgColor} strokeWidth={6} />
        <motion.circle
          cx={38}
          cy={38}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <span className={cn("absolute font-display text-lg font-bold", color)}>
        {score}
      </span>
    </div>
  );
}

function MermaidDiagram({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [svg, setSvg] = React.useState<string>("");
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
        });
        const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) return null;
  if (!svg) return <div className="h-16 animate-pulse rounded-lg bg-muted" />;

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-xl border border-border/50 bg-card p-4 [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function FeedbackDisplay({
  score,
  feedback,
}: {
  score: number;
  feedback: Feedback;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-2 flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
    >
      {/* Header: Score + Summary */}
      <div className="flex items-start gap-4">
        <ScoreRing score={score} />
        <div className="flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <BookOpenCheck className="size-3.5" /> Professor feedback
          </p>
          <p className="mt-1 text-sm font-medium leading-snug">{feedback.summary}</p>
        </div>
      </div>

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chart-2">
            <CheckCircle2 className="size-3.5" /> Strengths
          </p>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-chart-2" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weaknesses */}
      {feedback.weaknesses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <XCircle className="size-3.5" /> Areas for improvement
          </p>
          <ul className="space-y-1">
            {feedback.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Equations */}
      {feedback.equations && feedback.equations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chart-3">
            <Sparkles className="size-3.5" /> Key equations
          </p>
          <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card px-4 py-3">
            {feedback.equations.map((eq, i) => (
              <MathText key={i} text={eq} className="text-sm" />
            ))}
          </div>
        </div>
      )}

      {/* Diagram */}
      {feedback.diagram && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chart-4">
            <TrendingUp className="size-3.5" /> Visual explanation
          </p>
          <MermaidDiagram code={feedback.diagram} />
        </div>
      )}

      {/* Detailed Explanation */}
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Lightbulb className="size-3.5" /> Detailed explanation
        </p>
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          <MathText text={feedback.explanation} />
        </div>
      </div>

      {/* Improved Answer */}
      {feedback.improvedAnswer && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chart-2">
            <Sparkles className="size-3.5" /> Model answer
          </p>
          <div className="rounded-xl border border-chart-2/30 bg-chart-2/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            <MathText text={feedback.improvedAnswer} />
          </div>
        </div>
      )}
    </motion.div>
  );
}
