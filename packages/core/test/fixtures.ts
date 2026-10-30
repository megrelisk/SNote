import { createBlock, richText, type Block, type Drive, type Folder, type Note } from '../src';

export const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime();

export function workspace() {
  const t0 = at(2026, 10, 1);
  const drives: Drive[] = [
    { id: 'd1', name: 'Personal', icon: '🏠', order: 1, createdAt: t0, updatedAt: t0 },
    { id: 'd2', name: 'Work', icon: '💼', order: 2, createdAt: t0, updatedAt: t0 },
  ];
  const folders: Folder[] = [
    { id: 'f1', driveId: 'd1', name: 'Inbox', order: 1, createdAt: t0, updatedAt: t0 },
    { id: 'f2', driveId: 'd2', name: 'Meetings', order: 1, createdAt: t0, updatedAt: t0 },
  ];
  const notes: Note[] = [
    { id: 'n1', driveId: 'd1', folderId: 'f1', title: 'Groceries', preview: '', createdAt: t0, updatedAt: at(2026, 10, 3) },
    { id: 'n2', driveId: 'd2', folderId: 'f2', title: 'Standup', preview: '', createdAt: at(2026, 10, 2), updatedAt: at(2026, 10, 2) },
  ];
  return { drives, folders, notes };
}

export function textBlock(id: string, noteId: string, loc: { driveId: string; folderId: string }, created: number, text: string): Block {
  return createBlock('paragraph', { noteId, ...loc }, 1, { id, now: created, data: { text: richText.rt(text) } });
}
