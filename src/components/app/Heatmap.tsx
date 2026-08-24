import { fmtHours, prettyDate } from "@/lib/planning";

export function Heatmap({
  heatmap,
  selectedDay,
  onSelectDay,
}: {
  heatmap: { dayKey: string; hours: number }[];
  selectedDay?: string | null;
  onSelectDay?: (dayKey: string | null) => void;
}) {
  const max = Math.max(1, ...heatmap.map((d) => d.hours));
  const selected = selectedDay
    ? heatmap.find((d) => d.dayKey === selectedDay)
    : undefined;

  return (
    <div>
      <div
        className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]"
        role="img"
        aria-label="Study activity over the last seventeen weeks"
      >
        {heatmap.map(({ dayKey, hours }) => {
          const pct = hours === 0 ? 0 : Math.max(18, Math.round((hours / max) * 100));
          const isSelected = selectedDay === dayKey;
          return (
            <button
              key={dayKey}
              type="button"
              title={
                hours > 0
                  ? `${prettyDate(dayKey)} · ${fmtHours(hours)} done — click for details`
                  : `${prettyDate(dayKey)} · quiet day`
              }
              aria-label={`${prettyDate(dayKey)}: ${hours > 0 ? fmtHours(hours) + " studied" : "no study"}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay?.(isSelected ? null : dayKey)}
              className="size-[11px] rounded-[3px] border border-border/40 transition-transform hover:scale-125 hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{
                backgroundColor:
                  pct === 0
                    ? "var(--muted)"
                    : `color-mix(in oklab, var(--primary) ${pct}%, var(--card))`,
                ...(isSelected
                  ? { outline: "2px solid var(--primary)", outlineOffset: 1 }
                  : {}),
              }}
            />
          );
        })}
      </div>

      {selected ? (
        <div
          className="mt-3 flex items-center justify-between rounded-2xl border border-primary/25 bg-secondary/60 px-4 py-2.5 text-sm"
          role="status"
        >
          <span className="font-medium">{prettyDate(selected.dayKey)}</span>
          <span className="text-muted-foreground tabular-nums">
            {selected.hours > 0
              ? `${fmtHours(selected.hours)} studied`
              : "A quiet day — it happens"}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Quiet days fade — they don&apos;t judge. Click any square for its story.
        </p>
      )}
    </div>
  );
}
