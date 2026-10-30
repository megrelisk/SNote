import type { TableBlockData } from './types';

/** Pure helpers for dynamic tables. Every function returns a new value. */

function width(t: TableBlockData): number {
  return Math.max(1, ...t.rows.map((r) => r.length));
}

export function addRow(t: TableBlockData, at: number = t.rows.length): TableBlockData {
  const rows = t.rows.map((r) => [...r]);
  rows.splice(Math.max(0, Math.min(at, rows.length)), 0, Array(width(t)).fill(''));
  return { ...t, rows };
}

export function removeRow(t: TableBlockData, at: number): TableBlockData {
  if (t.rows.length <= 1) return t;
  return { ...t, rows: t.rows.filter((_, i) => i !== at) };
}

export function addColumn(t: TableBlockData, at: number = width(t)): TableBlockData {
  const w = width(t);
  const index = Math.max(0, Math.min(at, w));
  return {
    ...t,
    rows: t.rows.map((r) => {
      const row = [...r, ...Array(Math.max(0, w - r.length)).fill('')];
      row.splice(index, 0, '');
      return row;
    }),
  };
}

export function removeColumn(t: TableBlockData, at: number): TableBlockData {
  if (width(t) <= 1) return t;
  return { ...t, rows: t.rows.map((r) => r.filter((_, i) => i !== at)) };
}

export function setCell(t: TableBlockData, row: number, col: number, value: string): TableBlockData {
  return {
    ...t,
    rows: t.rows.map((r, i) => {
      if (i !== row) return r;
      const next = [...r];
      while (next.length <= col) next.push('');
      next[col] = value;
      return next;
    }),
  };
}

export function toggleHeader(t: TableBlockData): TableBlockData {
  return { ...t, header: !t.header };
}
