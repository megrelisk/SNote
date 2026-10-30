'use client';

import type { Block, BlockDataMap, BlockType, Note, NotesService, RichText } from '@snote/core';
import { createContext, useContext } from 'react';

export type FocusTarget = { blockId: string; offset: number | 'start' | 'end' };

export interface EditorApi {
  note: Note;
  blocks: Block[];
  service: NotesService;
  uid: string | null;
  /** Persist a block change (bumps updated_at + activity day). */
  save(block: Block): void;
  focus(target: FocusTarget): void;
  /** Enter inside a text block: keep `left` in this block, move `right` into a new one. */
  split(block: Block, left: RichText, right: RichText): void;
  /** Backspace at the very start of a block. */
  mergeBackward(block: Block, current: RichText): void;
  navigate(block: Block, direction: 'up' | 'down'): void;
  /** Inserts a block after `block` (or at the end when null). */
  insertAfter<T extends BlockType>(block: Block | null, type: T, data?: BlockDataMap[T]): Block;
  convert(block: Block, type: BlockType, text?: RichText): void;
  remove(block: Block): void;
  /** Opens the block menu for a block; an empty id closes it. */
  openMenu(blockId: string, mode: 'slash' | 'handle' | 'add', query?: string): void;
  attachFiles(files: File[], after: Block | null): void;
  numberFor(block: Block): number;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside the note editor');
  return ctx;
}
