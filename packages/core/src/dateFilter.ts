import { byOrder } from './order';
import { dayKey } from './time';
import type { Block, DayKey, Drive, Folder, Note } from './types';

/** Which timestamp(s) a date filter looks at. */
export type DateFilterField = 'any' | 'created' | 'updated';

/**
 * True when the block was created or edited on `day`.
 *
 * - `created`: the block's `createdAt` falls on that day.
 * - `updated`: the block was edited on that day (any edit, not only the latest).
 * - `any`: either of the above.
 */
export function blockMatchesDay(block: Block, day: DayKey, field: DateFilterField = 'any'): boolean {
  if (block.deleted) return false;
  const created = dayKey(block.createdAt) === day;
  const edited =
    (block.activityDays ?? []).includes(day) || dayKey(block.updatedAt) === day;
  if (field === 'created') return created;
  // A block that was never edited after creation only counts as "created".
  if (field === 'updated') return edited && !(created && block.updatedAt === block.createdAt);
  return created || edited;
}

export interface DateFilterNoteGroup {
  note: Note;
  blocks: Block[];
  /** True when the note itself (title / creation) was touched that day, even without block matches. */
  noteTouched: boolean;
}

export interface DateFilterFolderGroup {
  folder: Folder;
  notes: DateFilterNoteGroup[];
}

export interface DateFilterDriveGroup {
  drive: Drive;
  folders: DateFilterFolderGroup[];
}

export interface DateFilterResult {
  day: DayKey;
  drives: DateFilterDriveGroup[];
  blockCount: number;
  noteCount: number;
}

export interface DateFilterScope {
  driveId?: string;
  folderId?: string;
  noteId?: string;
}

/**
 * Groups every block created/modified on `day` by Drive → Folder → Note.
 * `blocks` may be a pre-filtered query result (e.g. Firestore `array-contains`)
 * or the full local cache — matching is re-checked here either way.
 */
export function filterByDate(
  input: {
    drives: readonly Drive[];
    folders: readonly Folder[];
    notes: readonly Note[];
    blocks: readonly Block[];
  },
  day: DayKey,
  options: { field?: DateFilterField; scope?: DateFilterScope } = {},
): DateFilterResult {
  const { field = 'any', scope = {} } = options;
  const inScope = (x: { driveId?: string; folderId?: string; noteId?: string; id?: string }) =>
    (!scope.driveId || x.driveId === scope.driveId) &&
    (!scope.folderId || x.folderId === scope.folderId) &&
    (!scope.noteId || (x.noteId ?? x.id) === scope.noteId);

  const notesById = new Map(input.notes.filter((n) => !n.deleted).map((n) => [n.id, n]));
  const blocksByNote = new Map<string, Block[]>();
  for (const block of input.blocks) {
    if (!inScope(block) || !blockMatchesDay(block, day, field)) continue;
    if (!notesById.has(block.noteId)) continue;
    const list = blocksByNote.get(block.noteId) ?? [];
    list.push(block);
    blocksByNote.set(block.noteId, list);
  }

  const noteTouchedOn = (n: Note) =>
    field === 'created'
      ? dayKey(n.createdAt) === day
      : field === 'updated'
        ? dayKey(n.updatedAt) === day
        : dayKey(n.createdAt) === day || dayKey(n.updatedAt) === day;

  const noteGroups: DateFilterNoteGroup[] = [];
  for (const note of notesById.values()) {
    if (!inScope({ ...note, noteId: note.id })) continue;
    const blocks = (blocksByNote.get(note.id) ?? []).sort(byOrder);
    const noteTouched = noteTouchedOn(note);
    if (blocks.length || noteTouched) noteGroups.push({ note, blocks, noteTouched });
  }

  const drives: DateFilterDriveGroup[] = [];
  const sortedDrives = [...input.drives].filter((d) => !d.deleted).sort(byOrder);
  const sortedFolders = [...input.folders].filter((f) => !f.deleted).sort(byOrder);
  for (const drive of sortedDrives) {
    const folders: DateFilterFolderGroup[] = [];
    for (const folder of sortedFolders.filter((f) => f.driveId === drive.id)) {
      const notes = noteGroups
        .filter((g) => g.note.folderId === folder.id)
        .sort((a, b) => b.note.updatedAt - a.note.updatedAt);
      if (notes.length) folders.push({ folder, notes });
    }
    if (folders.length) drives.push({ drive, folders });
  }

  const included = drives.flatMap((d) => d.folders.flatMap((f) => f.notes));
  return {
    day,
    drives,
    noteCount: included.length,
    blockCount: included.reduce((n, g) => n + g.blocks.length, 0),
  };
}

/** Days (within the given blocks) that have any activity — used to dot the calendar. */
export function activeDays(blocks: readonly Block[]): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const b of blocks) {
    if (b.deleted) continue;
    days.add(dayKey(b.createdAt));
    for (const d of b.activityDays ?? []) days.add(d);
  }
  return days;
}
