import { describe, expect, it, vi } from 'vitest';
import { FirestoreDocStore, type FirestoreModularApi, type SyncStatus } from '../src';

/** Minimal fake of the Firestore modular API, enough to verify the adapter's wiring. */
function fakeApi() {
  const writes: { op: string; path: string; data?: unknown; merge?: boolean }[] = [];
  let listener: ((snap: unknown) => void) | null = null;
  const api: FirestoreModularApi = {
    collection: (_db, path) => ({ path }),
    doc: (_db, path) => ({ path }),
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    where: (field, op, value) => ({ field, op, value }),
    onSnapshot: (_q, _opts, next) => {
      listener = next;
      return () => (listener = null);
    },
    getDoc: async (ref) => ({ exists: () => ref.path.endsWith('/n1'), data: () => ({ title: 'T' }) }),
    writeBatch: () => {
      const pending: typeof writes = [];
      return {
        set: (ref, data, opts) => pending.push({ op: 'set', path: ref.path, data, merge: opts?.merge }),
        delete: (ref) => pending.push({ op: 'delete', path: ref.path }),
        commit: async () => {
          writes.push(...pending);
        },
      };
    },
  };
  return { api, writes, emit: (snap: unknown) => listener?.(snap) };
}

describe('FirestoreDocStore', () => {
  it('scopes paths to the user, strips undefined and maps filters', async () => {
    const { api, writes, emit } = fakeApi();
    const store = new FirestoreDocStore(api, {}, 'u1');
    await store.write([
      { kind: 'set', collection: 'notes', id: 'n1', data: { title: 'x', pinned: undefined }, merge: true },
      { kind: 'delete', collection: 'blocks', id: 'b1' },
    ]);
    expect(writes).toEqual([
      { op: 'set', path: 'users/u1/notes/n1', data: { title: 'x' }, merge: true },
      { op: 'delete', path: 'users/u1/blocks/b1' },
    ]);

    const onData = vi.fn();
    const spy = vi.spyOn(api, 'where');
    store.watch('blocks', [{ field: 'activityDays', op: 'array-contains', value: '2026-10-27' }], onData);
    expect(spy).toHaveBeenCalledWith('activityDays', 'array-contains', '2026-10-27');
    emit({ docs: [{ id: 'b9', data: () => ({ noteId: 'n1' }) }], metadata: { fromCache: true, hasPendingWrites: true } });
    expect(onData).toHaveBeenCalledWith([{ id: 'b9', noteId: 'n1' }], { fromCache: true, hasPendingWrites: true });

    expect(await store.get('notes', 'n1')).toEqual({ title: 'T', id: 'n1' });
    expect(await store.get('notes', 'nope')).toBeNull();
  });

  it('reports offline / pending status', () => {
    const { api, emit } = fakeApi();
    let setOnline: (online: boolean) => void = () => {};
    const store = new FirestoreDocStore(api, {}, 'u1', (cb) => {
      setOnline = cb;
      return () => {};
    });
    const statuses: SyncStatus[] = [];
    store.watchStatus((s) => statuses.push(s));
    store.watch('drives', [], () => {});
    emit({ docs: [], metadata: { fromCache: false, hasPendingWrites: true } });
    expect(statuses.at(-1)).toMatchObject({ online: true, pendingWrites: true });
    setOnline(false);
    expect(statuses.at(-1)).toMatchObject({ online: false });
  });
});
