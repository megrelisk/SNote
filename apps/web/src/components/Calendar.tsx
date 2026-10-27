'use client';

import { addDays, dayKey, dayKeyToMs, type DayKey } from '@snote/core';
import { useMemo, useState } from 'react';
import { Icon } from './Icon';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function Calendar({ value, onChange, activeDays }: { value: DayKey; onChange: (d: DayKey) => void; activeDays: Set<DayKey> }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(dayKeyToMs(value));
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const today = dayKey(Date.now());

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = addDays(dayKey(first.getTime()), -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button className="icon-btn ghost small" onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" size={14} />
        </button>
        <span>{monthLabel}</span>
        <button className="icon-btn ghost small" onClick={() => shift(1)} aria-label="Next month">
          <Icon name="chevronRight" size={14} />
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="weekday">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = new Date(dayKeyToMs(d)).getMonth() === cursor.month;
          return (
            <button
              key={d}
              className={['day', !inMonth && 'muted', d === value && 'selected', d === today && 'today', activeDays.has(d) && 'has-activity']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChange(d)}
              aria-pressed={d === value}
              aria-label={d}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
