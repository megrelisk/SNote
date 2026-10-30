import { describe, expect, it } from 'vitest';
import {
  buildWidgetSnapshot,
  captureDeepLink,
  captureToNote,
  newCapture,
  noteDeepLink,
  parseDeepLink,
  selectCarouselNotes,
} from '../src';
import { at, workspace } from './fixtures';

describe('widget snapshot', () => {
  const ws = workspace();

  it('builds targets, a valid default target and cards newest first', () => {
    const snap = buildWidgetSnapshot({ ...ws, user: { displayName: 'Ana' }, now: at(2026, 10, 4) });
    expect(snap.signedIn).toBe(true);
    expect(snap.targets.map((t) => [t.id, t.folders.map((f) => f.id)])).toEqual([
      ['d1', ['f1']],
      ['d2', ['f2']],
    ]);
    expect(snap.defaultTarget).toEqual({ driveId: 'd1', folderId: 'f1' });
    expect(snap.notes.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(snap.notes[0]!.deepLink).toBe('snote://note/n1');
    expect(snap.notes[0]!.updatedAtLabel).toBe('2026-10-03 12:00:00');
  });

  it('falls back when the remembered target no longer exists', () => {
    const snap = buildWidgetSnapshot({ ...ws, user: null, defaultTarget: { driveId: 'd1', folderId: 'gone' } });
    expect(snap.defaultTarget).toEqual({ driveId: 'd1', folderId: 'f1' });
  });

  it('filters carousel cards by source', () => {
    const notes = ws.notes.map((n) => (n.id === 'n2' ? { ...n, pinned: true } : n));
    const snap = buildWidgetSnapshot({ ...ws, notes, user: null });
    expect(selectCarouselNotes(snap, { kind: 'recent' }).map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(selectCarouselNotes(snap, { kind: 'pinned' }).map((n) => n.id)).toEqual(['n2']);
    expect(selectCarouselNotes(snap, { kind: 'drive', driveId: 'd2' }).map((n) => n.id)).toEqual(['n2']);
    expect(selectCarouselNotes(snap, { kind: 'folder', folderId: 'f1' }).map((n) => n.id)).toEqual(['n1']);
    expect(selectCarouselNotes(snap, { kind: 'notes', noteIds: ['n2', 'x', 'n1'] }).map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(selectCarouselNotes(snap, { kind: 'recent' }, 1)).toHaveLength(1);
  });
});

describe('deep links', () => {
  it('round-trips note and capture links', () => {
    expect(parseDeepLink(noteDeepLink('a b'))).toEqual({ kind: 'note', noteId: 'a b' });
    expect(parseDeepLink(captureDeepLink({ driveId: 'd1', folderId: 'f 1' }))).toEqual({
      kind: 'capture',
      driveId: 'd1',
      folderId: 'f 1',
    });
    expect(parseDeepLink('snote://capture')).toEqual({ kind: 'capture', driveId: undefined, folderId: undefined });
    expect(parseDeepLink('https://example.com')).toEqual({ kind: 'unknown' });
  });
});

describe('quick capture', () => {
  it('turns the first line into the title and the rest into blocks', () => {
    const capture = { ...newCapture('', { driveId: 'd1', folderId: 'f1' }, 'widget', at(2026, 10, 5, 7, 1, 2)), text: 'Trip\n[ ] passport\n[x] tickets\n- sunscreen\n\nRemember the charger' };
    const { note, blocks } = captureToNote(capture);
    expect(note.id).toBe(capture.id);
    expect(note.title).toBe('Trip');
    expect(blocks.map((b) => b.type)).toEqual(['todo', 'todo', 'bulleted', 'paragraph']);
    expect(blocks[1]!.type === 'todo' && blocks[1]!.data.checked).toBe(true);
    expect(blocks.every((b) => b.createdAt === capture.createdAt)).toBe(true);
    expect(blocks.map((b) => b.id)).toEqual([0, 1, 2, 3].map((i) => `${capture.id}-${i}`));
    expect(note.preview).toBe('☐ passport');
  });

  it('creates a single empty paragraph for a title-only capture', () => {
    const { note, blocks } = captureToNote(newCapture('Call mom', { driveId: 'd', folderId: 'f' }));
    expect(note.title).toBe('Call mom');
    expect(blocks).toHaveLength(1);
  });
});
