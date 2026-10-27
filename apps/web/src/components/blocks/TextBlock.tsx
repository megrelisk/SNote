'use client';

import { richText, type BlockType, type Mark, type RichText, type TextLikeBlock } from '@snote/core';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useDebouncedCallback } from '@/lib/hooks';
import {
  caretOnFirstLine,
  caretOnLastLine,
  domToRichText,
  getSelectionOffsets,
  richTextToHtml,
  setSelectionOffsets,
} from '@/lib/richDom';
import { useEditor } from '../editorContext';

/**
 * Imperative handles for focused text blocks: the floating format bar uses
 * `toggle`, and the editor uses `setText` when it rewrites a block the user is
 * typing in (e.g. converting "/table" into a table block).
 */
export const textControllers = new Map<
  string,
  { toggle(mark: Mark): void; setText(text: RichText): void; currentText(): RichText; discardPending(): void }
>();

const SHORTCUTS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^#\s/, type: 'heading1' },
  { pattern: /^##\s/, type: 'heading2' },
  { pattern: /^###\s/, type: 'heading3' },
  { pattern: /^[-*•]\s/, type: 'bulleted' },
  { pattern: /^1[.)]\s/, type: 'numbered' },
  { pattern: /^\[\s?\]\s/, type: 'todo' },
  { pattern: /^```$/, type: 'code' },
];

const PLACEHOLDERS: Partial<Record<BlockType, string>> = {
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulleted: 'List',
  numbered: 'List',
  todo: 'To-do',
};

const MARK_KEYS: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline', e: 'code' };

export function TextBlock({ block, menuOpen }: { block: TextLikeBlock; menuOpen: boolean }) {
  const editor = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  const value = useRef<RichText>(block.data.text);
  const focused = useRef(false);
  /** Marks toggled with a collapsed caret (Ctrl+B then type) — applied to the next typed text. */
  const pendingMarks = useRef<Mark[] | null>(null);
  const latest = useRef(block);
  latest.current = block;

  const saver = useDebouncedCallback((text: RichText) => {
    const b = latest.current;
    editor.save({ ...b, data: { ...b.data, text } } as TextLikeBlock);
  }, 450);

  // Render remote / external changes, but never clobber what the user is typing.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    if (JSON.stringify(value.current) !== JSON.stringify(block.data.text) || el.innerHTML === '') {
      value.current = block.data.text;
      el.innerHTML = richTextToHtml(block.data.text);
    }
  }, [block.data.text]);

  const setContent = (next: RichText, caret?: { start: number; end?: number }) => {
    const el = ref.current!;
    value.current = next;
    el.innerHTML = richTextToHtml(next);
    if (caret) setSelectionOffsets(el, caret.start, caret.end ?? caret.start);
  };

  const toggle = (mark: Mark) => {
    const el = ref.current;
    if (!el) return;
    const sel = getSelectionOffsets(el);
    if (!sel) return;
    if (sel.start === sel.end) {
      const base = pendingMarks.current ?? richText.marksAt(value.current, sel.start);
      pendingMarks.current = base.includes(mark) ? base.filter((m) => m !== mark) : [...base, mark];
      return;
    }
    const next = richText.toggleMark(value.current, sel.start, sel.end, mark);
    setContent(next, sel);
    saver.call(next);
  };

  useEffect(() => {
    textControllers.set(block.id, {
      toggle,
      setText: (text) => setContent(text),
      currentText: () => value.current,
      discardPending: () => saver.cancel(),
    });
    return () => {
      textControllers.delete(block.id);
    };
  });

  useEffect(() => () => saver.flush(), [saver]);

  const onInput = () => {
    const el = ref.current!;
    let next = domToRichText(el);
    if (pendingMarks.current) {
      // Re-derive formatting from the previous value so the typed characters get the pending marks.
      const caret = getSelectionOffsets(el);
      next = richText.applyTextEdit(value.current, richText.plainText(next), pendingMarks.current);
      setContent(next, caret ?? undefined);
    }
    value.current = next;
    const plain = richText.plainText(next);

    if (block.type === 'paragraph') {
      for (const { pattern, type } of SHORTCUTS) {
        const m = pattern.exec(plain);
        if (m) {
          const rest = richText.slice(next, m[0].length);
          setContent(rest, { start: 0 });
          editor.convert(block, type, rest);
          return;
        }
      }
    }

    if (plain.startsWith('/') && !plain.includes(' ')) editor.openMenu(block.id, 'slash', plain.slice(1));
    else if (menuOpen) editor.openMenu('', 'slash');
    saver.call(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && MARK_KEYS[e.key.toLowerCase()]) {
      e.preventDefault();
      toggle(MARK_KEYS[e.key.toLowerCase()]!);
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      toggle('strike');
      return;
    }
    if (menuOpen && ['Enter', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) return;
    if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') pendingMarks.current = null;

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      saver.flush();
      const sel = getSelectionOffsets(el) ?? { start: 0, end: 0 };
      const current = richText.concat(richText.slice(value.current, 0, sel.start), richText.slice(value.current, sel.end));
      const isList = block.type === 'bulleted' || block.type === 'numbered' || block.type === 'todo';
      if (isList && richText.plainText(current) === '') {
        editor.convert(block, 'paragraph', []);
        return;
      }
      const [left, right] = richText.splitAt(current, sel.start);
      setContent(left);
      editor.split({ ...block, data: { ...block.data, text: left } } as TextLikeBlock, left, right);
      return;
    }

    if (e.key === 'Backspace') {
      const sel = getSelectionOffsets(el);
      if (sel && sel.start === 0 && sel.end === 0) {
        e.preventDefault();
        saver.flush();
        editor.mergeBackward(block, value.current);
      }
      return;
    }

    if (e.key === 'ArrowUp' && !e.shiftKey && caretOnFirstLine(el)) {
      e.preventDefault();
      editor.navigate(block, 'up');
    } else if (e.key === 'ArrowDown' && !e.shiftKey && caretOnLastLine(el)) {
      e.preventDefault();
      editor.navigate(block, 'down');
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      editor.attachFiles(files, block);
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n/g, '\n');
    if (!text) return;
    const el = ref.current!;
    const sel = getSelectionOffsets(el) ?? { start: richText.plainText(value.current).length, end: richText.plainText(value.current).length };
    const marks = richText.marksAt(value.current, sel.start);
    const next = richText.concat(
      richText.slice(value.current, 0, sel.start),
      [{ text, marks: marks.length ? marks : undefined }],
      richText.slice(value.current, sel.end),
    );
    setContent(next, { start: sel.start + text.length });
    saver.call(next);
  };

  const checked = block.type === 'todo' && block.data.checked;

  return (
    <div className={`text-block type-${block.type}${checked ? ' checked' : ''}`}>
      {block.type === 'bulleted' && <span className="list-marker">•</span>}
      {block.type === 'numbered' && <span className="list-marker num">{editor.numberFor(block)}.</span>}
      {block.type === 'todo' && (
        <input
          type="checkbox"
          className="todo-check"
          checked={block.data.checked}
          aria-label={checked ? 'Mark as not done' : 'Mark as done'}
          onChange={(e) => {
            saver.flush();
            editor.save({ ...block, data: { ...block.data, text: value.current, checked: e.target.checked } });
          }}
        />
      )}
      <div
        ref={ref}
        className="editable"
        data-editable
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        spellCheck
        data-placeholder={PLACEHOLDERS[block.type] ?? "Type '/' for blocks, or just write…"}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => (focused.current = true)}
        onMouseDown={() => (pendingMarks.current = null)}
        onBlur={() => {
          focused.current = false;
          pendingMarks.current = null;
          saver.flush();
        }}
      />
    </div>
  );
}
