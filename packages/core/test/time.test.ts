import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayKeyToMs, formatTimestamp, isValidDayKey, withActivityDay } from '../src';

describe('time', () => {
  it('formats timestamps down to the second', () => {
    const ms = new Date(2026, 9, 5, 7, 8, 9).getTime();
    expect(formatTimestamp(ms)).toBe('2026-10-05 07:08:09');
    expect(dayKey(ms)).toBe('2026-10-05');
  });

  it('round-trips and validates day keys', () => {
    expect(dayKey(dayKeyToMs('2024-02-29'))).toBe('2024-02-29');
    expect(isValidDayKey('2023-02-29')).toBe(false);
    expect(isValidDayKey('nope')).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('keeps activity days sorted and unique', () => {
    expect(withActivityDay(['2026-01-02'], '2026-01-01')).toEqual(['2026-01-01', '2026-01-02']);
    expect(withActivityDay(['2026-01-01'], '2026-01-01')).toEqual(['2026-01-01']);
  });
});
