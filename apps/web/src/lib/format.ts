/** 125 -> "02:05" (minutes can exceed 59, e.g. a 50-minute session shows "50:00"). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso));

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n} ${n === 1 ? one : many}`;
