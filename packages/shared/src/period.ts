/** UTC day/week keys used by quests, streaks and daily caps. Everything is UTC (documented in DECISIONS). */

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday 00:00 UTC of the ISO week containing d. */
export function startOfIsoWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * 86_400_000);
}

/** ISO-8601 week key like "2026-W43" (week-year can differ from the calendar year near Jan 1). */
export function isoWeekKey(d: Date): string {
  const monday = startOfIsoWeek(d);
  const thursday = new Date(monday.getTime() + 3 * 86_400_000);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstMonday = startOfIsoWeek(firstThursday);
  const week = Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 86_400_000)) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export const periodKey = (period: 'daily' | 'weekly', d: Date): string =>
  period === 'daily' ? dayKey(d) : isoWeekKey(d);

/** When the current period ends (the instant the next one starts). */
export function periodEnd(period: 'daily' | 'weekly', d: Date): Date {
  return period === 'daily'
    ? new Date(startOfUtcDay(d).getTime() + 86_400_000)
    : new Date(startOfIsoWeek(d).getTime() + 7 * 86_400_000);
}

/** Whole UTC days from a to b (b later => positive). */
export const utcDayDiff = (a: Date, b: Date): number =>
  Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / 86_400_000);
