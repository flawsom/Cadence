import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const MILESTONES = [3, 7, 14, 30, 50, 100] as const;

const MILESTONE_MESSAGES: Record<number, { title: string; subtitle: string }> = {
  3: { title: "Getting warm!", subtitle: "3 days — you're building momentum." },
  7: { title: "One full week!", subtitle: "7 days — this is becoming a habit." },
  14: { title: "Two weeks strong!", subtitle: "14 days — you're unstoppable." },
  30: { title: "A whole month!", subtitle: "30 days — dedication personified." },
  50: { title: "Half-century!", subtitle: "50 days — legendary commitment." },
  100: { title: "Centurion!", subtitle: "100 days — you've mastered showing up." },
};

// Deterministic particle positions based on streak
function generateParticles(streak: number) {
  const count = streak >= 50 ? 24 : streak >= 30 ? 18 : streak >= 14 ? 14 : 10;
  const particles = [];
  for (let i = 0; i < count; i++) {
    // Use a simple seeded pseudo-random
    const seed = (streak * 31 + i * 17) % 100;
    const angle = (seed / 100) * Math.PI * 2;
    const distance = 40 + (seed % 60);
    particles.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 20,
      rotation: seed * 3.6,
      scale: 0.6 + (seed % 40) / 100,
      delay: i * 0.04,
      color:
        i % 5 === 0
          ? "#E85A2A"
          : i % 5 === 1
            ? "#F59E0B"
            : i % 5 === 2
              ? "#10B981"
              : i % 5 === 3
                ? "#7B6CF0"
                : "#DB2763",
    });
  }
  return particles;
}

function ConfettiParticles({ streak }: { streak: number }) {
  const particles = useMemo(() => generateParticles(streak), [streak]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{
            opacity: 1,
            x: "50%",
            y: "50%",
            scale: 0,
            rotate: 0,
          }}
          animate={{
            opacity: [1, 1, 0],
            x: `calc(50% + ${p.x}px)`,
            y: `calc(50% + ${p.y}px)`,
            scale: [0, p.scale, p.scale * 0.5],
            rotate: [0, p.rotation, p.rotation * 2],
          }}
          transition={{
            duration: 1.2,
            delay: p.delay,
            ease: "easeOut",
          }}
          className="absolute size-2 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

export function StreakCelebration({
  streak,
  className,
}: {
  streak: number;
  className?: string;
}) {
  const [celebrated, setCelebrated] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const milestone = useMemo(() => {
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (streak >= MILESTONES[i]) return MILESTONES[i];
    }
    return null;
  }, [streak]);

  // Trigger celebration only when we hit a NEW milestone
  useEffect(() => {
    if (milestone && milestone !== celebrated) {
      setCelebrated(milestone);
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [milestone, celebrated]);

  const dismiss = useCallback(() => setShowCelebration(false), []);

  if (!milestone || streak === 0) return null;

  const msg = MILESTONE_MESSAGES[milestone];

  return (
    <>
      {/* Persistent badge showing current milestone */}
      <div
        className={cn(
          "relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
          milestone >= 30
            ? "border-primary/40 bg-primary/10 text-primary"
            : milestone >= 7
              ? "border-chart-1/40 bg-chart-1/10 text-chart-1"
              : "border-chart-1/30 bg-chart-1/5 text-chart-1",
          className,
        )}
      >
        <Flame className="size-3.5" />
        {streak}-day streak
        {milestone >= 30 && (
          <span className="ml-0.5 text-[9px] uppercase tracking-wide opacity-70">
            ★
          </span>
        )}
      </div>

      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={dismiss}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-4 w-full max-w-xs overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-2xl"
            >
              <ConfettiParticles streak={streak} />

              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 12,
                  delay: 0.1,
                }}
                className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10"
              >
                <Flame className="size-8 text-primary" />
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="font-display text-xl font-bold"
              >
                {msg.title}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-2 text-sm text-muted-foreground"
              >
                {msg.subtitle}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-xs text-muted-foreground/60"
              >
                Tap anywhere to dismiss
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
