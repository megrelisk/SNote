'use client';

import type { BlockOf } from '@snote/core';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/lib/hooks';
import { useEditor } from '../editorContext';

const LANGUAGES = ['plain', 'javascript', 'typescript', 'python', 'json', 'html', 'css', 'bash', 'sql', 'swift', 'kotlin', 'go', 'rust'];

export function CodeBlock({ block }: { block: BlockOf<'code'> }) {
  const editor = useEditor();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [code, setCode] = useState(block.data.code);
  const focused = useRef(false);
  const latest = useRef(block);
  latest.current = block;
  const saver = useDebouncedCallback((next: string) => {
    editor.save({ ...latest.current, data: { ...latest.current.data, code: next } });
  }, 450);

  useEffect(() => {
    if (!focused.current) setCode(block.data.code);
  }, [block.data.code]);
  useEffect(() => () => saver.flush(), [saver]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [code]);

  return (
    <div className="code-block">
      <select
        className="code-lang"
        value={block.data.language ?? 'plain'}
        onChange={(e) => editor.save({ ...block, data: { code, language: e.target.value } })}
        aria-label="Code language"
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <textarea
        ref={ref}
        data-editable
        spellCheck={false}
        value={code}
        placeholder="// code"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          saver.flush();
        }}
        onChange={(e) => {
          setCode(e.target.value);
          saver.call(e.target.value);
        }}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if (e.key === 'Tab') {
            e.preventDefault();
            const { selectionStart: s, selectionEnd: end } = el;
            const next = `${code.slice(0, s)}  ${code.slice(end)}`;
            setCode(next);
            saver.call(next);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          } else if (e.key === 'Backspace' && code === '') {
            e.preventDefault();
            editor.mergeBackward(block, []);
          } else if (e.key === 'ArrowUp' && el.selectionStart === 0) {
            e.preventDefault();
            editor.navigate(block, 'up');
          } else if (e.key === 'ArrowDown' && el.selectionEnd === code.length) {
            e.preventDefault();
            editor.navigate(block, 'down');
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            saver.flush();
            editor.focus({ blockId: editor.insertAfter(block, 'paragraph').id, offset: 'start' });
          }
        }}
      />
    </div>
  );
}
