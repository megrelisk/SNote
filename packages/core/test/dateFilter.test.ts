import { describe, expect, it } from 'vitest';
import { activeDays, blockMatchesDay, filterByDate, touchBlock } from '../src';
import { at, textBlock, workspace } from './fixtures';

describe('date filter', () => {
  const ws = workspace();
  const b1 = textBlock('b1', 'n1', { driveId: 'd1', folderId: 'f1' }, at(2026, 10, 1, 9), 'milk');
  // Created on the 1st, edited on the 3rd.
  const b2 = touchBlock(textBlock('b2', 'n1', { driveId: 'd1', folderId: 'f1' }, at(2026, 10, 1, 10), 'eggs'), {}, at(2026, 10, 3, 8));
  const b3 = textBlock('b3', 'n2', { driveId: 'd2', folderId: 'f2' }, at(2026, 10, 2, 9, 30), 'notes');
  const blocks = [b1, b2, b3];

  it('matches blocks by creation and by every edit day', () => {
    expect(blockMatchesDay(b2, '2026-10-01')).toBe(true);
    expect(blockMatchesDay(b2, '2026-10-03')).toBe(true);
    expect(blockMatchesDay(b2, '2026-10-02')).toBe(false);
    expect(blockMatchesDay(b2, '2026-10-03', 'created')).toBe(false);
    expect(blockMatchesDay(b2, '2026-10-03', 'updated')).toBe(true);
    expect(blockMatchesDay(b1, '2026-10-01', 'updated')).toBe(false);
  });

  it('groups results by drive → folder → note', () => {
    const result = filterByDate({ ...ws, blocks }, '2026-10-01');
    expect(result.drives.map((d) => d.drive.id)).toEqual(['d1']);
    const group = result.drives[0]!.folders[0]!.notes[0]!;
    expect(group.note.id).toBe('n1');
    expect(group.blocks.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
    expect(result.blockCount).toBe(2);
  });

  it('respects scope and only-edited filter', () => {
    const scoped = filterByDate({ ...ws, blocks }, '2026-10-02', { scope: { driveId: 'd1' } });
    expect(scoped.noteCount).toBe(0);
    const edited = filterByDate({ ...ws, blocks }, '2026-10-03', { field: 'updated' });
    expect(edited.drives[0]!.folders[0]!.notes[0]!.blocks.map((b) => b.id)).toEqual(['b2']);
  });

  it('collects active days for the calendar', () => {
    expect([...activeDays(blocks)].sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
});
