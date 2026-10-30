'use client';

import {
  dayKey,
  filterByDate,
  formatTimestamp,
  noteDisplayTitle,
  richText,
  type Block,
  type DateFilterField,
  type DateFilterScope,
  type DayKey,
  type Drive,
  type Folder,
  type Note,
} from '@snote/core';
import { useMemo } from 'react';
import { useBlocksOnDay } from '@/lib/hooks';
import { Calendar } from './Calendar';
import { Icon } from './Icon';

export interface DateFilterState {
  day: DayKey;
  field: DateFilterField;
  scope: DateFilterScope;
}

/** Column 2 in date mode: calendar + filter options. */
export function DateFilterPanel({
  state,
  onChange,
  notes,
  drives,
  folders,
  onBack,
}: {
  state: DateFilterState;
  onChange: (s: DateFilterState) => void;
  notes: Note[];
  drives: Drive[];
  folders: Folder[];
  onBack: () => void;
}) {
  const activeDays = useMemo(() => {
    const days = new Set<DayKey>();
    for (const n of notes) {
      days.add(dayKey(n.createdAt));
      days.add(dayKey(n.updatedAt));
    }
    return days;
  }, [notes]);

  const scopeValue = state.scope.folderId ? `f:${state.scope.folderId}` : state.scope.driveId ? `d:${state.scope.driveId}` : 'all';

  return (
    <section className="note-list date-panel" aria-label="Date filter">
      <header className="list-header">
        <button className="icon-btn ghost mobile-only" onClick={onBack} aria-label="Back">
          <Icon name="chevronLeft" />
        </button>
        <h2>Filter by date</h2>
        <button className="ghost small" onClick={() => onChange({ ...state, day: dayKey(Date.now()) })}>
          Today
        </button>
      </header>
      <Calendar value={state.day} onChange={(day) => onChange({ ...state, day })} activeDays={activeDays} />
      <div className="filter-options">
        <label>
          <span>Show blocks</span>
          <select value={state.field} onChange={(e) => onChange({ ...state, field: e.target.value as DateFilterField })}>
            <option value="any">Created or edited</option>
            <option value="created">Created</option>
            <option value="updated">Edited</option>
          </select>
        </label>
        <label>
          <span>Search in</span>
          <select
            value={scopeValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') onChange({ ...state, scope: {} });
              else if (v.startsWith('d:')) onChange({ ...state, scope: { driveId: v.slice(2) } });
              else {
                const folder = folders.find((f) => f.id === v.slice(2));
                onChange({ ...state, scope: { driveId: folder?.driveId, folderId: v.slice(2) } });
              }
            }}
          >
            <option value="all">All drives (global)</option>
            {drives.map((d) => (
              <optgroup key={d.id} label={`${d.icon ?? ''} ${d.name}`}>
                <option value={`d:${d.id}`}>Entire {d.name}</option>
                {folders
                  .filter((f) => f.driveId === d.id)
                  .map((f) => (
                    <option key={f.id} value={`f:${f.id}`}>
                      {d.name} / {f.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">Dots mark days with note activity. Results include every block created or edited on the selected day, even if it changed again later.</p>
    </section>
  );
}

/** Column 3 in date mode: matching blocks grouped by Drive → Folder → Note. */
export function DateFilterResults({
  state,
  notes,
  drives,
  folders,
  onOpenNote,
}: {
  state: DateFilterState;
  notes: Note[];
  drives: Drive[];
  folders: Folder[];
  onOpenNote: (noteId: string, blockId?: string) => void;
}) {
  const { items: blocks, loading } = useBlocksOnDay(state.day);
  const result = useMemo(
    () => filterByDate({ drives, folders, notes, blocks }, state.day, { field: state.field, scope: state.scope }),
    [drives, folders, notes, blocks, state],
  );
  const pretty = new Date(`${state.day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="editor date-results">
      <header className="editor-header">
        <Icon name="calendar" />
        <strong>{pretty}</strong>
        <div className="spacer" />
        <span className="muted">
          {result.blockCount} block{result.blockCount === 1 ? '' : 's'} · {result.noteCount} note{result.noteCount === 1 ? '' : 's'}
        </span>
      </header>
      <div className="editor-scroll">
        <div className="editor-page">
          {loading && <p className="muted">Searching…</p>}
          {!loading && result.drives.length === 0 && (
            <div className="empty-state">
              <Icon name="calendar" size={32} />
              <p>Nothing was created or edited on this day.</p>
            </div>
          )}
          {result.drives.map(({ drive, folders: fgroups }) => (
            <section key={drive.id} className="result-drive">
              <h3>
                {drive.icon} {drive.name}
              </h3>
              {fgroups.map(({ folder, notes: ngroups }) => (
                <div key={folder.id} className="result-folder">
                  <h4>
                    <Icon name="folder" size={14} /> {folder.name}
                  </h4>
                  {ngroups.map(({ note, blocks: nb, noteTouched }) => (
                    <article key={note.id} className="result-note">
                      <button className="result-note-title" onClick={() => onOpenNote(note.id)}>
                        {noteDisplayTitle(note)} <Icon name="chevronRight" size={12} />
                      </button>
                      {nb.length === 0 && noteTouched && <p className="muted small">Note created or renamed on this day.</p>}
                      {nb.map((b) => (
                        <button key={b.id} className="result-block" onClick={() => onOpenNote(note.id, b.id)}>
                          <BlockPreview block={b} />
                          <span className="result-stamps">
                            <span className={dayKey(b.createdAt) === state.day ? 'hit' : ''}>Created {formatTimestamp(b.createdAt)}</span>
                            {b.updatedAt !== b.createdAt && (
                              <span className={dayKey(b.updatedAt) === state.day ? 'hit' : ''}>Edited {formatTimestamp(b.updatedAt)}</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </article>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BlockPreview({ block }: { block: Block }) {
  switch (block.type) {
    case 'code':
      return <pre className="preview-code">{block.data.code}</pre>;
    case 'image':
      return (
        <span className="preview-media">
          <Icon name="image" /> {block.data.caption || block.data.image?.name || 'Image'}
        </span>
      );
    case 'file':
      return (
        <span className="preview-media">
          <Icon name="file" /> {block.data.file?.name ?? 'File'}
        </span>
      );
    case 'table':
      return (
        <span className="preview-media">
          <Icon name="table" /> Table · {block.data.rows.length}×{Math.max(0, ...block.data.rows.map((r) => r.length))}
        </span>
      );
    case 'todo':
      return (
        <span className={`preview-text todo${block.data.checked ? ' checked' : ''}`}>
          <input type="checkbox" readOnly checked={block.data.checked} tabIndex={-1} />
          <span dangerouslySetInnerHTML={{ __html: richText.toHtml(block.data.text) || '&nbsp;' }} />
        </span>
      );
    default:
      return (
        <span
          className={`preview-text type-${block.type}`}
          dangerouslySetInnerHTML={{ __html: richText.toHtml(block.data.text) || '<em class="muted">Empty</em>' }}
        />
      );
  }
}
