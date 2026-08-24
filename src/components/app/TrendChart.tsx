import { fmtHours, prettyDate } from "@/lib/planning";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Interactive trend line of daily completed hours across the heatmap window.
 * Hover any point for the exact day + duration.
 */
export function TrendChart({
  data,
}: {
  data: { dayKey: string; hours: number }[];
}) {
  const chartData = data.map((d) => ({ ...d, label: prettyDate(d.dayKey) }));

  return (
    <div className="h-44 w-full" role="img" aria-label="Daily study hours over the last seventeen weeks">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground, #78716c)" }}
            interval={20}
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
            formatter={(value) => [fmtHours(Number(value)), "Studied"]}
          />
          <Line
            type="monotone"
            dataKey="hours"
            stroke="var(--color-primary, #e85a2a)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
