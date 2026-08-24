import { fmtHours, prettyDate } from "@/lib/planning";

export function Heatmap({
  heatmap,
}: {
  heatmap: { dayKey: string; hours: number }[];
}) {
  const max = Math.max(1, ...heatmap.map((d) => d.hours));

  return (
    <div>
      <div
        className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]"
        role="img"
        aria-label="Study activity over the last seventeen weeks"
      >
        {heatmap.map(({ dayKey, hours }) => {
          const pct = hours === 0 ? 0 : Math.max(18, Math.round((hours / max) * 100));
          return (
            <div
              key={dayKey}
              title={
                hours > 0
                  ? `${prettyDate(dayKey)} · ${fmtHours(hours)} done`
                  : prettyDate(dayKey)
              }
              className="size-[11px] rounded-[3px] border border-border/40"
              style={{
                backgroundColor:
                  pct === 0
                    ? "var(--muted)"
                    : `color-mix(in oklab, var(--primary) ${pct}%, var(--card))`,
              }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Quiet days fade — they don&apos;t judge.
      </p>
    </div>
  );
}
