'use client';

import { table, type BlockOf, type TableBlockData } from '@snote/core';
import { useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from '@/lib/hooks';
import { Icon } from '../Icon';
import { useEditor } from '../editorContext';

export function TableBlock({ block }: { block: BlockOf<'table'> }) {
  const editor = useEditor();
  const [data, setData] = useState<TableBlockData>(block.data);
  const editing = useRef(false);
  const latest = useRef(block);
  latest.current = block;
  const saver = useDebouncedCallback((next: TableBlockData) => editor.save({ ...latest.current, data: next }), 450);

  useEffect(() => {
    if (!editing.current) setData(block.data);
  }, [block.data]);
  useEffect(() => () => saver.flush(), [saver]);

  const update = (next: TableBlockData, immediate = false) => {
    setData(next);
    if (immediate) {
      saver.flush();
      editor.save({ ...latest.current, data: next });
    } else saver.call(next);
  };

  const cols = Math.max(1, ...data.rows.map((r) => r.length));
  return (
    <div className="table-block">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="col-tools">
                  <button title="Insert column left" onClick={() => update(table.addColumn(data, c), true)}>
                    <Icon name="plus" size={12} />
                  </button>
                  <button title="Delete column" disabled={cols <= 1} onClick={() => update(table.removeColumn(data, c), true)}>
                    <Icon name="x" size={12} />
                  </button>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r} className={data.header && r === 0 ? 'header-row' : undefined}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c}>
                    <textarea
                      data-editable={r === 0 && c === 0 ? true : undefined}
                      rows={1}
                      value={row[c] ?? ''}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      onFocus={() => (editing.current = true)}
                      onBlur={() => {
                        editing.current = false;
                        saver.flush();
                      }}
                      onChange={(e) => update(table.setCell(data, r, c, e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const body = e.currentTarget.closest('tbody');
                          if (r === data.rows.length - 1) update(table.addRow(data), true);
                          requestAnimationFrame(() => {
                            body?.rows[r + 1]?.cells[c]?.querySelector('textarea')?.focus();
                          });
                        }
                      }}
                    />
                  </td>
                ))}
                <td className="row-tools">
                  <button title="Delete row" disabled={data.rows.length <= 1} onClick={() => update(table.removeRow(data, r), true)}>
                    <Icon name="x" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-actions">
        <button className="ghost small" onClick={() => update(table.addRow(data), true)}>
          <Icon name="plus" size={12} /> Row
        </button>
        <button className="ghost small" onClick={() => update(table.addColumn(data), true)}>
          <Icon name="plus" size={12} /> Column
        </button>
        <label className="toggle small">
          <input type="checkbox" checked={data.header} onChange={() => update(table.toggleHeader(data), true)} /> Header row
        </label>
      </div>
    </div>
  );
}
