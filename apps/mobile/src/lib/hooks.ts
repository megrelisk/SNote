import {
  byOrder,
  type Block,
  type CollectionMap,
  type CollectionName,
  type DayKey,
  type Drive,
  type Filter,
  type Folder,
  type Note,
  type SnapshotMeta,
} from '@snote/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from './session';

export interface WatchResult<T> {
  items: T[];
  loading: boolean;
  meta: SnapshotMeta | null;
}

/** Live query against the signed-in user's store. `key` must change whenever `filters` change. */
export function useWatch<C extends CollectionName>(collection: C, filters: Filter[] | null, key: string): WatchResult<CollectionMap[C]> {
  const { service } = useSession();
  const [state, setState] = useState<WatchResult<CollectionMap[C]>>({ items: [], loading: true, meta: null });
  useEffect(() => {
    if (!service || !filters) {
      setState({ items: [], loading: false, meta: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return service.store.watch(
      collection,
      filters,
      (items, meta) => setState({ items, loading: false, meta }),
      () => setState((s) => ({ ...s, loading: false })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, collection, key]);
  return state;
}

export function useDrives(): Drive[] {
  const { items } = useWatch('drives', [], 'all');
  return useMemo(() => items.filter((d) => !d.deleted).sort(byOrder), [items]);
}

export function useFolders(): Folder[] {
  const { items } = useWatch('folders', [], 'all');
  return useMemo(() => items.filter((f) => !f.deleted).sort(byOrder), [items]);
}

export function useNotes(): Note[] {
  const { items } = useWatch('notes', [], 'all');
  return useMemo(() => items.filter((n) => !n.deleted).sort((a, b) => b.updatedAt - a.updatedAt), [items]);
}

export function useNoteBlocks(noteId: string | null): WatchResult<Block> {
  const result = useWatch('blocks', noteId ? [{ field: 'noteId', op: '==', value: noteId }] : null, `note:${noteId}`);
  const items = useMemo(() => result.items.filter((b) => !b.deleted).sort(byOrder), [result.items]);
  return { ...result, items };
}

export function useBlocksOnDay(day: DayKey | null): WatchResult<Block> {
  return useWatch('blocks', day ? [{ field: 'activityDays', op: 'array-contains', value: day }] : null, `day:${day}`);
}

/** Debounced callback with explicit flush/cancel (used to batch keystrokes into block saves). */
export function useDebounced<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const state = useRef<{ timer: ReturnType<typeof setTimeout> | null; args: A | null }>({ timer: null, args: null });
  return useMemo(() => {
    const run = () => {
      const { args } = state.current;
      state.current = { timer: null, args: null };
      if (args) fnRef.current(...args);
    };
    return {
      call: (...args: A) => {
        if (state.current.timer) clearTimeout(state.current.timer);
        state.current = { args, timer: setTimeout(run, delay) };
      },
      flush: () => {
        if (state.current.timer) clearTimeout(state.current.timer);
        run();
      },
      cancel: () => {
        if (state.current.timer) clearTimeout(state.current.timer);
        state.current = { timer: null, args: null };
      },
    };
  }, [delay]);
}
