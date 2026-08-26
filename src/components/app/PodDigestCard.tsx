import { motion } from "framer-motion";
import { Trophy, Clock, Users, TrendingUp } from "lucide-react";

interface DigestMember {
  name: string;
  weeklyHours: number;
  totalDone: number;
  totalTasks: number;
  planCount: number;
}

interface DigestData {
  weekEnding: string;
  memberStats: DigestMember[];
  totalPodHours: number;
  topPerformerName: string;
}

export function PodDigestCard({ digest }: { digest: DigestData }) {
  if (!digest || digest.memberStats.length === 0) return null;

  const maxHours = Math.max(...digest.memberStats.map((m) => m.weeklyHours), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-card/80 p-5 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Trophy className="size-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold">
            Weekly Pod Digest
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Week ending{" "}
            {new Date(digest.weekEnding + "T00:00:00").toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric" },
            )}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-background/50 px-3 py-2.5 text-center">
          <Users className="mx-auto size-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {digest.memberStats.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Members</p>
        </div>
        <div className="rounded-2xl bg-background/50 px-3 py-2.5 text-center">
          <Clock className="mx-auto size-4 text-muted-foreground" />
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {digest.totalPodHours}h
          </p>
          <p className="text-[10px] text-muted-foreground">Total studied</p>
        </div>
        <div className="rounded-2xl bg-background/50 px-3 py-2.5 text-center">
          <TrendingUp className="mx-auto size-4 text-muted-foreground" />
          <p className="mt-1 text-sm font-semibold">
            {digest.topPerformerName}
          </p>
          <p className="text-[10px] text-muted-foreground">Top performer</p>
        </div>
      </div>

      {/* Member progress bars */}
      <div className="mt-4 flex flex-col gap-2.5">
        {digest.memberStats.map((member, i) => {
          const width = Math.max(8, (member.weeklyHours / maxHours) * 100);
          const isTop = i === 0;
          return (
            <div key={member.name} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-xs font-medium">
                {isTop && "👑 "}
                {member.name}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-background/50">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{
                    delay: i * 0.1,
                    duration: 0.6,
                    ease: "easeOut",
                  }}
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    isTop ? "bg-primary" : "bg-primary/40"
                  }`}
                />
                <span className="relative z-10 flex h-full items-center pl-2 text-[10px] font-semibold text-foreground/80">
                  {member.weeklyHours}h
                </span>
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
                {member.totalDone}/{member.totalTasks} done
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
