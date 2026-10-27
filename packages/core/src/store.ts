import type { Block, Drive, Folder, Note } from './types';

/**
 * Storage abstraction. The UI never talks to a database directly: it goes
 * through `NotesService`, which writes through a `DocStore`.
 *
 * Implementations:
 *  - `FirestoreDocStore` (web + mobile): Firestore's own offline cache
 *    (IndexedDB on web, the native SQLite/LevelDB cache on mobile) gives
 *    offline-first reads, queued writes and automatic sync on reconnect.
 *  - `MemoryDocStore`: in-memory store with optional persistence hooks, used
 *    for tests and for the web app's local "no account" mode.
 */

export interface CollectionMap {
  drives: Drive;
  folders: Folder;
  notes: Note;
  blocks: Block;
}

export type CollectionName = keyof CollectionMap;

export const COLLECTIONS: readonly CollectionName[] = ['drives', 'folders', 'notes', 'blocks'];

export type Filter =
  | { field: string; op: '=='; value: string | number | boolean }
  | { field: string; op: 'array-contains'; value: string };

export interface SnapshotMeta {
  /** True when results come only from the local cache (server not reached yet). */
  fromCache: boolean;
  /** True while local writes in these results have not been acknowledged by the server. */
  hasPendingWrites: boolean;
}

export type WriteOp =
  | { kind: 'set'; collection: CollectionName; id: string; data: object; merge?: boolean }
  | { kind: 'delete'; collection: CollectionName; id: string };

export type Unsubscribe = () => void;

export interface SyncStatus {
  online: boolean;
  /** Local changes not yet confirmed by the cloud. */
  pendingWrites: boolean;
  /** Last error surfaced by the backend, if any. */
  error: string | null;
}

export interface DocStore {
  readonly kind: 'firestore' | 'memory';
  watch<C extends CollectionName>(
    collection: C,
    filters: readonly Filter[],
    onData: (items: CollectionMap[C][], meta: SnapshotMeta) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  get<C extends CollectionName>(collection: C, id: string): Promise<CollectionMap[C] | null>;
  /**
   * Applies writes atomically. Writes are applied to the local cache
   * immediately; the returned promise resolves once the backend has
   * acknowledged them (which, offline, may be much later — callers should
   * not block the UI on it).
   */
  write(ops: readonly WriteOp[]): Promise<void>;
  watchStatus(onStatus: (status: SyncStatus) => void): Unsubscribe;
}

/** Firestore rejects `undefined`; strip it recursively before writing. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export function matchesFilters(item: object, filters: readonly Filter[]): boolean {
  const record = item as Record<string, unknown>;
  return filters.every((f) => {
    const v = record[f.field];
    if (f.op === '==') return v === f.value;
    return Array.isArray(v) && v.includes(f.value);
  });
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

export type MemoryData = { [C in CollectionName]: Record<string, CollectionMap[C]> };

export interface MemoryPersistence {
  load(): MemoryData | null;
  save(data: MemoryData): void;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class MemoryDocStore implements DocStore {
  readonly kind = 'memory' as const;
  private data: MemoryData;
  private listeners = new Set<() => void>();

  constructor(private readonly persistence?: MemoryPersistence) {
    this.data = persistence?.load() ?? { drives: {}, folders: {}, notes: {}, blocks: {} };
    for (const c of COLLECTIONS) this.data[c] ??= {};
  }

  watch<C extends CollectionName>(
    collection: C,
    filters: readonly Filter[],
    onData: (items: CollectionMap[C][], meta: SnapshotMeta) => void,
  ): Unsubscribe {
    const emit = () => {
      const items = Object.values(this.data[collection] as Record<string, CollectionMap[C]>)
        .filter((item) => matchesFilters(item, filters))
        .map(clone);
      onData(items, { fromCache: false, hasPendingWrites: false });
    };
    this.listeners.add(emit);
    emit();
    return () => {
      this.listeners.delete(emit);
    };
  }

  async get<C extends CollectionName>(collection: C, id: string): Promise<CollectionMap[C] | null> {
    const item = (this.data[collection] as Record<string, CollectionMap[C]>)[id];
    return item ? clone(item) : null;
  }

  async write(ops: readonly WriteOp[]): Promise<void> {
    for (const op of ops) {
      const table = this.data[op.collection] as Record<string, object>;
      if (op.kind === 'delete') {
        delete table[op.id];
      } else {
        const data = stripUndefined(clone(op.data));
        table[op.id] = op.merge ? { ...(table[op.id] ?? {}), ...data } : data;
      }
    }
    this.persistence?.save(this.data);
    for (const listener of [...this.listeners]) listener();
  }

  watchStatus(onStatus: (status: SyncStatus) => void): Unsubscribe {
    onStatus({ online: true, pendingWrites: false, error: null });
    return () => {};
  }

  /** Replaces all data (used when importing / switching local profiles). */
  reset(data?: MemoryData): void {
    this.data = data ? clone(data) : { drives: {}, folders: {}, notes: {}, blocks: {} };
    this.persistence?.save(this.data);
    for (const listener of [...this.listeners]) listener();
  }

  dump(): MemoryData {
    return clone(this.data);
  }
}
