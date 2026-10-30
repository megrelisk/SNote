import { describe, expect, it } from 'vitest';
import { addColumn, addRow, removeColumn, removeRow, setCell } from '../src/table';
import { needsRebalance, orderBetween, orderForMove } from '../src';

describe('ordering', () => {
  it('computes midpoints and ends', () => {
    expect(orderBetween()).toBe(1024);
    expect(orderBetween(1024)).toBe(2048);
    expect(orderBetween(undefined, 1024)).toBe(0);
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderForMove([1, 2, 3], 2, 0)).toBe(1 - 1024);
    expect(needsRebalance([1, 1 + 1e-9])).toBe(true);
  });
});

describe('tables', () => {
  const t = { header: true, rows: [['a', 'b'], ['c', 'd']] };
  it('adds and removes rows and columns', () => {
    expect(addRow(t).rows).toEqual([['a', 'b'], ['c', 'd'], ['', '']]);
    expect(addRow(t, 0).rows[0]).toEqual(['', '']);
    expect(addColumn(t, 1).rows).toEqual([['a', '', 'b'], ['c', '', 'd']]);
    expect(removeColumn(t, 0).rows).toEqual([['b'], ['d']]);
    expect(removeRow(t, 0).rows).toEqual([['c', 'd']]);
    expect(removeRow({ header: false, rows: [['x']] }, 0).rows).toEqual([['x']]);
    expect(setCell(t, 1, 3, 'z').rows[1]).toEqual(['c', 'd', '', 'z']);
    expect(t.rows).toEqual([['a', 'b'], ['c', 'd']]);
  });
});
