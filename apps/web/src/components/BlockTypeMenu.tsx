'use client';

import { BLOCK_LABELS, type BlockType } from '@snote/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export const BLOCK_MENU: { type: BlockType; icon: IconName; hint: string; keywords: string }[] = [
  { type: 'paragraph', icon: 'text', hint: 'Plain text', keywords: 'text paragraph p' },
  { type: 'heading1', icon: 'heading', hint: '#', keywords: 'h1 heading title' },
  { type: 'heading2', icon: 'heading', hint: '##', keywords: 'h2 heading subtitle' },
  { type: 'heading3', icon: 'heading', hint: '###', keywords: 'h3 heading' },
  { type: 'bulleted', icon: 'list', hint: '-', keywords: 'bullet list ul unordered' },
  { type: 'numbered', icon: 'numbered', hint: '1.', keywords: 'numbered list ol ordered' },
  { type: 'todo', icon: 'todo', hint: '[]', keywords: 'todo checkbox task check' },
  { type: 'code', icon: 'code', hint: '```', keywords: 'code snippet pre' },
  { type: 'image', icon: 'image', hint: 'Upload', keywords: 'image picture photo media' },
  { type: 'file', icon: 'file', hint: 'PDF, DOC, ZIP…', keywords: 'file attachment pdf doc zip upload' },
  { type: 'table', icon: 'table', hint: 'Rows × columns', keywords: 'table grid spreadsheet' },
];

export function BlockTypeMenu({
  onPick,
  onClose,
  query = '',
  extra,
}: {
  onPick: (type: BlockType) => void;
  onClose: () => void;
  query?: string;
  extra?: { label: string; icon: IconName; danger?: boolean; onClick: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? BLOCK_MENU.filter((i) => BLOCK_LABELS[i.type].toLowerCase().includes(q) || i.keywords.includes(q))
      : BLOCK_MENU;
  }, [query]);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && items[active]) {
        e.preventDefault();
        e.stopPropagation();
        onPick(items[active].type);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onDown);
    };
  }, [items, active, onPick, onClose]);

  return (
    <div className="menu block-menu" ref={ref} role="menu" onMouseDown={(e) => e.preventDefault()}>
      {extra?.length ? (
        <>
          {extra.map((x) => (
            <button key={x.label} className={`menu-item${x.danger ? ' danger' : ''}`} onClick={x.onClick} role="menuitem">
              <Icon name={x.icon} />
              <span>{x.label}</span>
            </button>
          ))}
          <div className="menu-sep">Turn into</div>
        </>
      ) : (
        <div className="menu-sep">Blocks</div>
      )}
      {items.length === 0 && <div className="menu-empty">No matching blocks</div>}
      {items.map((item, i) => (
        <button
          key={item.type}
          role="menuitem"
          className={`menu-item${i === active ? ' active' : ''}`}
          onMouseEnter={() => setActive(i)}
          onClick={() => onPick(item.type)}
        >
          <Icon name={item.icon} />
          <span>{BLOCK_LABELS[item.type]}</span>
          <kbd>{item.hint}</kbd>
        </button>
      ))}
    </div>
  );
}
