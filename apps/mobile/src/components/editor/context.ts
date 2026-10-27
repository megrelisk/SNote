import type { Block, BlockDataMap, BlockType, Mark, Note, NotesService, RichText } from '@snote/core';
import { createContext, useContext } from 'react';
import type { TextInputInstance } from 'react-native';

export interface TextController {
  toggleMark(mark: Mark): void;
  activeMarks(): Mark[];
  currentText(): RichText;
  discardPending(): void;
  setText(text: RichText): void;
}

export type MediaSource = 'library' | 'camera' | 'file';

export interface MobileEditorApi {
  note: Note;
  blocks: Block[];
  service: NotesService;
  focusedId: string | null;
  selectedId: string | null;
  save(block: Block): void;
  split(block: Block, left: RichText, right: RichText): void;
  mergeBackward(block: Block, current: RichText): void;
  insertAfter<T extends BlockType>(block: Block | null, type: T, data?: BlockDataMap[T]): Block;
  convert(block: Block, type: BlockType, text?: RichText): void;
  remove(block: Block): void;
  focus(blockId: string, position?: 'start' | 'end' | number): void;
  select(blockId: string | null): void;
  setFocused(blockId: string | null): void;
  registerInput(blockId: string, input: TextInputInstance | null): void;
  registerController(blockId: string, controller: TextController | null): void;
  openTypeMenu(blockId: string, mode: 'convert' | 'insert'): void;
  attach(source: MediaSource, block: Block): void;
  numberFor(block: Block): number;
}

export const EditorContext = createContext<MobileEditorApi | null>(null);

export function useEditor(): MobileEditorApi {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside the note editor');
  return value;
}
