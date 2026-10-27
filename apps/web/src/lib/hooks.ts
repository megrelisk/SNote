'use client';

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
import { useEffect, useMemo, useState } from 'react';
import { useSession } from './session';

export interface WatchResult<T> {
  items: T[];
  loading: boolean;
  meta: SnapshotMeta | null;
}

/** Live query against the active store. `key` must change whenever `filters` change. */
export function useWatch<C extends CollectionName>(
  collection: C,
  filters: Filter[] | null,
  key: string,
): WatchResult<CollectionMap[C]> {
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

/** Blocks created or modified on a given day (single `array-contains` query). */
export function useBlocksOnDay(day: DayKey | null): WatchResult<Block> {
  return useWatch('blocks', day ? [{ field: 'activityDays', op: 'array-contains', value: day }] : null, `day:${day}`);
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const [state] = useState(() => ({ timer: null as ReturnType<typeof setTimeout> | null, fn, args: null as A | null }));
  state.fn = fn;
  return useMemo(() => {
    const call = (...args: A) => {
      state.args = args;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.args) state.fn(...state.args);
        state.args = null;
      }, delay);
    };
    const flush = () => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      if (state.args) state.fn(...state.args);
      state.args = null;
    };
    const cancel = () => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      state.args = null;
    };
    return { call, flush, cancel };
  }, [state, delay]);
}
