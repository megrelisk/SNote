'use client';

import { noteDisplayTitle, relativeTime, type Drive, type Folder, type Note } from '@snote/core';
import { useMemo, useState } from 'react';
import { useSession } from '@/lib/session';
import { Icon } from './Icon';
import type { Selection } from './Sidebar';

export function NoteList({
  notes,
  drives,
  folders,
  selection,
  activeNoteId,
  onOpen,
  onBack,
}: {
  notes: Note[];
  drives: Drive[];
  folders: Folder[];
  selection: Exclude<Selection, { kind: 'date' }>;
  activeNoteId: string | null;
  onOpen: (noteId: string) => void;
  onBack: () => void;
}) {
  const { service } = useSession();
  const [query, setQuery] = useState('');

  const { title, list, target } = useMemo(() => {
    let list = notes;
    let title = 'Recently modified';
    let target: { driveId: string; folderId: string } | null = null;
    if (selection.kind === 'pinned') {
      list = notes.filter((n) => n.pinned);
      title = 'Pinned';
    } else if (selection.kind === 'drive') {
      list = notes.filter((n) => n.driveId === selection.driveId);
      title = drives.find((d) => d.id === selection.driveId)?.name ?? 'Drive';
      const firstFolder = folders.find((f) => f.driveId === selection.driveId);
      target = firstFolder ? { driveId: selection.driveId, folderId: firstFolder.id } : null;
    } else if (selection.kind === 'folder') {
      list = notes.filter((n) => n.folderId === selection.folderId);
      title = folders.find((f) => f.id === selection.folderId)?.name ?? 'Folder';
      target = { driveId: selection.driveId, folderId: selection.folderId };
    }
    if (!target) {
      const latest = notes[0];
      const fallback = folders[0];
      target = latest ? { driveId: latest.driveId, folderId: latest.folderId } : fallback ? { driveId: fallback.driveId, folderId: fallback.id } : null;
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((n) => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q));
    return { title, list, target };
  }, [notes, drives, folders, selection, query]);

  const pathOf = (n: Note) => {
    const d = drives.find((x) => x.id === n.driveId);
    const f = folders.find((x) => x.id === n.folderId);
    return `${d?.icon ?? ''} ${d?.name ?? ''} / ${f?.name ?? ''}`;
  };

  return (
    <section className="note-list" aria-label="Notes">
      <header className="list-header">
        <button className="icon-btn ghost mobile-only" onClick={onBack} aria-label="Back to drives">
          <Icon name="chevronLeft" />
        </button>
        <h2>{title}</h2>
        <button
          className="primary small"
          disabled={!target || !service}
          title={target ? 'New note' : 'Create a folder first'}
          onClick={() => {
            if (!target || !service) return;
            onOpen(service.createNote(target).note.id);
          }}
        >
          <Icon name="plus" size={14} /> New
        </button>
      </header>
      <div className="search">
        <Icon name="search" size={14} />
        <input placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="notes">
        {list.length === 0 && <li className="empty">{query ? 'No matching notes.' : 'No notes here yet.'}</li>}
        {list.map((n) => (
          <li key={n.id}>
            <button className={`note-item${n.id === activeNoteId ? ' active' : ''}`} onClick={() => onOpen(n.id)}>
              <div className="note-item-top">
                <span className="note-item-title">
                  {n.pinned && <Icon name="pin" size={12} />} {noteDisplayTitle(n)}
                </span>
                <time title={new Date(n.updatedAt).toLocaleString()}>{relativeTime(n.updatedAt)}</time>
              </div>
              <p className="note-item-preview">{n.preview || 'Empty note'}</p>
              {selection.kind !== 'folder' && <span className="note-item-path">{pathOf(n)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
