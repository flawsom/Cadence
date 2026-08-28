import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Coffee, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "focus" | "break";

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;
const FOCUS_SECONDS = FOCUS_MINUTES * 60;
const BREAK_SECONDS = BREAK_MINUTES * 60;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Second tone
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = "sine";
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.5);
    }, 200);
  } catch {
    // Audio not available — silent fallback
  }
}

export function PomodoroTimer({ className }: { className?: string }) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(FOCUS_SECONDS);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const pct = remaining / total;
  const circumference = 2 * Math.PI * 44; // r=44

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // Phase complete
          clearInterval(intervalRef.current!);
          setRunning(false);
          playChime();

          if (phase === "focus") {
            setSessions((s) => s + 1);
            setPhase("break");
            return BREAK_SECONDS;
          } else {
            setPhase("focus");
            return FOCUS_SECONDS;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase]);

  const toggle = useCallback(() => setRunning((r) => !r), []);
  const reset = useCallback(() => {
    setRunning(false);
    setPhase("focus");
    setRemaining(FOCUS_SECONDS);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4",
        className,
      )}
    >
      {/* Ring progress */}
      <div className="relative size-28">
        <svg
          className="size-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="6"
          />
          {/* Progress */}
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={phase === "focus" ? "var(--primary)" : "#2A9D8F"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="font-mono text-2xl font-bold tabular-nums"
            >
              {formatTime(remaining)}
            </motion.span>
          </AnimatePresence>
          <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            {phase === "focus" ? (
              <>
                <Zap className="size-2.5 text-primary" /> Focus
              </>
            ) : (
              <>
                <Coffee className="size-2.5 text-[#2A9D8F]" /> Break
              </>
            )}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggle}
          className={cn(
            "flex size-10 items-center justify-center rounded-full shadow-pop-sm transition-colors",
            running
              ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={running ? "Pause timer" : "Start timer"}
        >
          {running ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4 ml-0.5" />
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={reset}
          className="flex size-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Reset timer"
        >
          <RotateCcw className="size-3.5" />
        </motion.button>
      </div>

      {/* Session count */}
      {sessions > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {sessions} session{sessions === 1 ? "" : "s"} completed
        </p>
      )}
    </div>
  );
}
