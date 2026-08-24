/**
 * Cadence client date/format utilities — pure TypeScript, no I/O.
 *
 * The syllabus→schedule engine lives in src/convex/lib.ts (heuristicParse)
 * and src/convex/plans.ts (createPlan); this module holds only the shared
 * formatting helpers the UI imports.
 */

// ---------------------------------------------------------------------------
// Dates (all dates are plain "yyyy-mm-dd" strings, client-local)
// ---------------------------------------------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(dateStr: string, n: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round(
    (parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000,
  );
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function prettyDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function longDate(dateStr: string): string {
  return parseISODate(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (Number.isInteger(h)) return `${h}h`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins === 0 ? `${whole}h` : `${whole}h ${mins}m`;
}
