import { createBlock, notePreview, touchBlock } from './blocks';
import { newId } from './ids';
import { byOrder, needsRebalance, ORDER_STEP, orderBetween, rebalancedOrders } from './order';
import type { CollectionMap, CollectionName, DocStore, Filter, WriteOp } from './store';
import type { Block, BlockDataMap, BlockOf, BlockType, Drive, EpochMs, Folder, Note } from './types';
import { captureToNote, type PendingCapture } from './widget';

/** Starter workspace created the first time an account has no drives. */
export const STARTER_DRIVES: ReadonlyArray<{ id: string; name: string; icon: string; folders: string[] }> = [
  { id: 'personal', name: 'Personal Drive', icon: '🏠', folders: ['Inbox', 'Ideas'] },
  { id: 'work', name: 'Work Drive', icon: '💼', folders: ['Inbox', 'Meetings'] },
  { id: 'study', name: 'Study Drive', icon: '🎓', folders: ['Inbox', 'Lectures'] },
];

/**
 * Domain operations on top of a `DocStore`. All methods apply changes to the
 * local cache synchronously (from the UI's point of view) and return the new
 * entities; cloud acknowledgement happens in the background. Errors from the
 * background commit are reported through `onWriteError`.
 */
export class NotesService {
  constructor(
    readonly store: DocStore,
    private readonly onWriteError: (error: unknown) => void = (e) => console.error('[snote] write failed', e),
    private readonly clock: () => EpochMs = Date.now,
  ) {}

  private commit(ops: WriteOp[]): void {
    if (ops.length === 0) return;
    this.store.write(ops).catch(this.onWriteError);
  }

  /** One-shot read through the (offline-capable) watch API. */
  once<C extends CollectionName>(collection: C, filters: Filter[] = []): Promise<CollectionMap[C][]> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | null = null;
      let done = false;
      unsubscribe = this.store.watch(
        collection,
        filters,
        (items) => {
          if (done) return;
          done = true;
          resolve(items);
          // The first callback may fire synchronously, before `unsubscribe` is assigned.
          void Promise.resolve().then(() => unsubscribe?.());
        },
        (error) => {
          if (done) return;
          done = true;
          reject(error);
        },
      );
    });
  }

  // -- Drives ---------------------------------------------------------------

  createDrive(name: string, icon = '🗂', order?: number): Drive {
    const now = this.clock();
    const drive: Drive = { id: newId(), name: name.trim() || 'New Drive', icon, order: order ?? now, createdAt: now, updatedAt: now };
    this.commit([{ kind: 'set', collection: 'drives', id: drive.id, data: drive }]);
    return drive;
  }

  updateDrive(id: string, patch: Partial<Pick<Drive, 'name' | 'icon' | 'order'>>): void {
    this.commit([{ kind: 'set', collection: 'drives', id, data: { ...patch, updatedAt: this.clock() }, merge: true }]);
  }

  async deleteDrive(id: string): Promise<void> {
    const [folders, notes, blocks] = await Promise.all([
      this.once('folders', [{ field: 'driveId', op: '==', value: id }]),
      this.once('notes', [{ field: 'driveId', op: '==', value: id }]),
      this.once('blocks', [{ field: 'driveId', op: '==', value: id }]),
    ]);
    this.commit([
      ...blocks.map((b) => del('blocks', b.id)),
      ...notes.map((n) => del('notes', n.id)),
      ...folders.map((f) => del('folders', f.id)),
      del('drives', id),
    ]);
  }

  // -- Folders --------------------------------------------------------------

  createFolder(driveId: string, name: string, order?: number): Folder {
    const now = this.clock();
    const folder: Folder = { id: newId(), driveId, name: name.trim() || 'New Folder', order: order ?? now, createdAt: now, updatedAt: now };
    this.commit([{ kind: 'set', collection: 'folders', id: folder.id, data: folder }]);
    return folder;
  }

  updateFolder(id: string, patch: Partial<Pick<Folder, 'name' | 'order'>>): void {
    this.commit([{ kind: 'set', collection: 'folders', id, data: { ...patch, updatedAt: this.clock() }, merge: true }]);
  }

  async deleteFolder(id: string): Promise<void> {
    const [notes, blocks] = await Promise.all([
      this.once('notes', [{ field: 'folderId', op: '==', value: id }]),
      this.once('blocks', [{ field: 'folderId', op: '==', value: id }]),
    ]);
    this.commit([...blocks.map((b) => del('blocks', b.id)), ...notes.map((n) => del('notes', n.id)), del('folders', id)]);
  }

  // -- Notes ----------------------------------------------------------------

  createNote(target: { driveId: string; folderId: string }, title = ''): { note: Note; firstBlock: Block } {
    const now = this.clock();
    const note: Note = { id: newId(), ...target, title, preview: '', createdAt: now, updatedAt: now };
    const firstBlock = createBlock('paragraph', { noteId: note.id, ...target }, ORDER_STEP, { now });
    this.commit([
      { kind: 'set', collection: 'notes', id: note.id, data: note },
      { kind: 'set', collection: 'blocks', id: firstBlock.id, data: firstBlock },
    ]);
    return { note, firstBlock };
  }

  updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'pinned'>>): void {
    this.commit([{ kind: 'set', collection: 'notes', id, data: { ...patch, updatedAt: this.clock() }, merge: true }]);
  }

  async moveNote(note: Note, target: { driveId: string; folderId: string }): Promise<void> {
    const blocks = await this.once('blocks', [{ field: 'noteId', op: '==', value: note.id }]);
    const now = this.clock();
    this.commit([
      { kind: 'set', collection: 'notes', id: note.id, data: { ...target, updatedAt: now }, merge: true },
      ...blocks.map((b): WriteOp => ({ kind: 'set', collection: 'blocks', id: b.id, data: { ...target }, merge: true })),
    ]);
  }

  async deleteNote(id: string): Promise<void> {
    const blocks = await this.once('blocks', [{ field: 'noteId', op: '==', value: id }]);
    this.commit([...blocks.map((b) => del('blocks', b.id)), del('notes', id)]);
  }

  // -- Blocks ---------------------------------------------------------------

  private noteTouch(noteId: string, blocksAfter: readonly Block[], now: EpochMs): WriteOp {
    return {
      kind: 'set',
      collection: 'notes',
      id: noteId,
      data: { updatedAt: now, preview: notePreview(blocksAfter) },
      merge: true,
    };
  }

  /**
   * Inserts a block after `afterId` (or at the end). `siblings` is the note's
   * current block list. Returns the new block plus any re-ordered siblings.
   */
  insertBlock<T extends BlockType>(
    note: Pick<Note, 'id' | 'driveId' | 'folderId'>,
    siblings: readonly Block[],
    type: T,
    options: { afterId?: string | null; data?: BlockDataMap[T] } = {},
  ): BlockOf<T> {
    const now = this.clock();
    let sorted = [...siblings].sort(byOrder);
    const ops: WriteOp[] = [];
    let index = options.afterId === null ? 0 : sorted.length;
    if (options.afterId) {
      const i = sorted.findIndex((b) => b.id === options.afterId);
      if (i >= 0) index = i + 1;
    }
    let order = orderBetween(sorted[index - 1]?.order, sorted[index]?.order);
    if (needsRebalance([sorted[index - 1]?.order ?? order - 1, order, sorted[index]?.order ?? order + 1])) {
      const orders = rebalancedOrders(sorted.length + 1);
      sorted = sorted.map((b, i) => ({ ...b, order: orders[i < index ? i : i + 1]! }));
      for (const b of sorted) ops.push({ kind: 'set', collection: 'blocks', id: b.id, data: { order: b.order }, merge: true });
      order = orders[index]!;
    }
    const block = createBlock(type, { noteId: note.id, driveId: note.driveId, folderId: note.folderId }, order, {
      now,
      data: options.data,
    });
    ops.push({ kind: 'set', collection: 'blocks', id: block.id, data: block });
    ops.push(this.noteTouch(note.id, [...sorted, block as Block], now));
    this.commit(ops);
    return block;
  }

  /** Saves a modified block, bumping `updatedAt` and recording today's activity. */
  saveBlock(next: Block, siblings: readonly Block[]): Block {
    const now = this.clock();
    const touched = touchBlock(next, {}, now);
    const after = siblings.map((b) => (b.id === touched.id ? touched : b));
    this.commit([
      { kind: 'set', collection: 'blocks', id: touched.id, data: touched },
      this.noteTouch(touched.noteId, after, now),
    ]);
    return touched;
  }

  deleteBlock(block: Block, siblings: readonly Block[]): void {
    const now = this.clock();
    this.commit([
      del('blocks', block.id),
      this.noteTouch(block.noteId, siblings.filter((b) => b.id !== block.id), now),
    ]);
  }

  /** Moves a block to `toIndex` in the note's ordering (drag-and-drop). */
  moveBlock(block: Block, siblings: readonly Block[], toIndex: number): Block {
    const sorted = [...siblings].sort(byOrder).filter((b) => b.id !== block.id);
    const clamped = Math.max(0, Math.min(toIndex, sorted.length));
    const orders = sorted.map((b) => b.order);
    let order = orderBetween(orders[clamped - 1], orders[clamped]);
    const ops: WriteOp[] = [];
    if (needsRebalance([orders[clamped - 1] ?? order - 1, order, orders[clamped] ?? order + 1])) {
      const fresh = rebalancedOrders(sorted.length + 1);
      sorted.forEach((b, i) => {
        ops.push({ kind: 'set', collection: 'blocks', id: b.id, data: { order: fresh[i < clamped ? i : i + 1] }, merge: true });
      });
      order = fresh[clamped]!;
    }
    // Reordering is a structural change, not a content edit: timestamps stay as they are.
    const moved = { ...block, order } as Block;
    ops.push({ kind: 'set', collection: 'blocks', id: block.id, data: { order }, merge: true });
    this.commit(ops);
    return moved;
  }

  // -- Quick capture --------------------------------------------------------

  /**
   * Writes a widget / shortcut capture as a new note. Idempotent: a capture
   * whose note already exists is skipped, so a queue can be drained twice.
   */
  async ingestCapture(capture: PendingCapture): Promise<Note | null> {
    if (!capture.text.trim()) return null;
    const existing = await this.store.get('notes', capture.id);
    if (existing) return existing;
    const { note, blocks } = captureToNote(capture);
    this.commit([
      { kind: 'set', collection: 'notes', id: note.id, data: note },
      ...blocks.map((b): WriteOp => ({ kind: 'set', collection: 'blocks', id: b.id, data: b })),
    ]);
    return note;
  }

  // -- Bootstrap ------------------------------------------------------------

  /**
   * Creates the starter Drives/Folders. Call only once the server has
   * confirmed the account is empty (snapshot `fromCache === false`), so a
   * fresh install that is still restoring data never duplicates anything.
   * Ids are deterministic for the same reason.
   */
  createStarterContent(): void {
    const now = this.clock();
    const ops: WriteOp[] = [];
    STARTER_DRIVES.forEach((d, i) => {
      const drive: Drive = { id: d.id, name: d.name, icon: d.icon, order: (i + 1) * ORDER_STEP, createdAt: now, updatedAt: now };
      ops.push({ kind: 'set', collection: 'drives', id: drive.id, data: drive, merge: true });
      d.folders.forEach((name, j) => {
        const id = `${d.id}-${name.toLowerCase()}`;
        const folder: Folder = { id, driveId: d.id, name, order: (j + 1) * ORDER_STEP, createdAt: now, updatedAt: now };
        ops.push({ kind: 'set', collection: 'folders', id, data: folder, merge: true });
      });
    });
    this.commit(ops);
  }
}

function del(collection: CollectionName, id: string): WriteOp {
  return { kind: 'delete', collection, id };
}
