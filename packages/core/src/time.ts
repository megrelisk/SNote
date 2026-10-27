import type { DayKey, EpochMs } from './types';

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** `YYYY-MM-DD HH:mm:ss` in the device's local time zone. */
export function formatTimestamp(ms: EpochMs): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Local calendar day (`YYYY-MM-DD`) that contains `ms`. */
export function dayKey(ms: EpochMs): DayKey {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a `YYYY-MM-DD` key into local-midnight epoch ms. Returns NaN for malformed input. */
export function dayKeyToMs(key: DayKey): EpochMs {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return NaN;
  return d.getTime();
}

export function isValidDayKey(key: string): key is DayKey {
  return !Number.isNaN(dayKeyToMs(key));
}

/** Shifts a day key by `delta` days (handles month/year boundaries and DST). */
export function addDays(key: DayKey, delta: number): DayKey {
  const ms = dayKeyToMs(key);
  const d = new Date(ms);
  d.setDate(d.getDate() + delta);
  return dayKey(d.getTime());
}

/** Short relative label for lists and widgets: "just now", "5m", "3h", or the date. */
export function relativeTime(ms: EpochMs, now: EpochMs = Date.now()): string {
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (dayKey(ms) === addDays(dayKey(now), -1)) return 'yesterday';
  return dayKey(ms);
}

/** Adds a day to an activity list, keeping it sorted and duplicate-free. */
export function withActivityDay(days: readonly DayKey[], day: DayKey): DayKey[] {
  if (days.includes(day)) return [...days];
  return [...days, day].sort();
}
