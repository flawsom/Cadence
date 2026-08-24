import { fmtHours, prettyDate } from "@/lib/planning";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Member line colors — you are always the brand orange. */
const MEMBER_COLORS = [
  "var(--color-chart-2, #2A9D8F)",
  "var(--color-chart-4, #7B6CF0)",
  "var(--color-chart-3, #E9B44C)",
  "var(--color-chart-5, #63a375)",
];

export function memberColor(index: number, isYou: boolean): string {
  return isYou
    ? "var(--color-primary, #E85A2A)"
    : MEMBER_COLORS[index % MEMBER_COLORS.length];
}

type BoardMember = {
  name: string;
  isYou: boolean;
  series: { dayKey: string; hours: number }[];
};

/**
 * Side-by-side trend of daily completed hours for every pod member.
 * Hover any day to compare exact numbers; everything updates live.
 */
export function PodCompareChart({
  dayKeys,
  members,
}: {
  dayKeys: string[];
  members: BoardMember[];
}) {
  // Two members can share a display name — uniquify so their lines never merge.
  const nameCounts = new Map<string, number>();
  const seriesKeys = members.map((m) => {
    const n = nameCounts.get(m.name) ?? 0;
    nameCounts.set(m.name, n + 1);
    return n === 0 ? m.name : `${m.name} (${n + 1})`;
  });

  const data = dayKeys.map((dk, i) => {
    const row: Record<string, string | number> = {
      label: prettyDate(dk),
      short:
        i === dayKeys.length - 1
          ? "Today"
          : new Date(`${dk}T00:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            }),
    };
    members.forEach((m, mi) => {
      row[seriesKeys[mi]] = m.series[i]?.hours ?? 0;
    });
    return row;
  });

  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label={`Daily study hours compared across ${members.length} pod members`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="short"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #78716c)" }}
            interval="preserveStartEnd"
            minTickGap={24}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #78716c)" }}
            tickLine={false}
            axisLine={false}
            width={34}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-card, #fff)",
              border: "1px solid var(--color-border, #e7e5e4)",
              borderRadius: 14,
              fontSize: 12,
              color: "var(--color-card-foreground, #1c1917)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
            labelStyle={{ color: "var(--color-foreground, #1c1917)", fontWeight: 600 }}
            formatter={(value, name) => [fmtHours(Number(value)), name as string]}
          />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
          />
          {members.map((m, i) => (
            <Line
              key={seriesKeys[i]}
              type="monotone"
              dataKey={seriesKeys[i]}
              name={m.name}
              stroke={memberColor(i, m.isYou)}
              strokeWidth={m.isYou ? 2.75 : 2}
              strokeDasharray={m.isYou ? undefined : "1 0"}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
