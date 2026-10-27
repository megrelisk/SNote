'use client';

import { dayKey } from '@snote/core';
import { useCallback, useEffect, useState } from 'react';
import { useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { DateFilterPanel, DateFilterResults, type DateFilterState } from './DateFilter';
import { Icon } from './Icon';
import { NoteEditor } from './NoteEditor';
import { NoteList } from './NoteList';
import { Sidebar, type Selection } from './Sidebar';

type Pane = 'nav' | 'list' | 'main';

/** Desktop: Drives & Folders → Notes list → Editor. Narrow screens show one pane at a time. */
export function Workspace() {
  const { error } = useSession();
  const drives = useDrives();
  const folders = useFolders();
  const notes = useNotes();
  const [selection, setSelection] = useState<Selection>({ kind: 'recent' });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('list');
  const [dateState, setDateState] = useState<DateFilterState>({ day: dayKey(Date.now()), field: 'any', scope: {} });
  const [showDateResults, setShowDateResults] = useState(true);

  // Deep links: /?note=<id> opens a note directly (used by shared links and the mobile widgets' web fallback).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const noteId = params.get('note');
    if (noteId) {
      setActiveNoteId(noteId);
      setPane('main');
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeNoteId) url.searchParams.set('note', activeNoteId);
    else url.searchParams.delete('note');
    window.history.replaceState(null, '', url);
  }, [activeNoteId]);

  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  const openNote = useCallback((noteId: string, blockId?: string) => {
    setActiveNoteId(noteId);
    setShowDateResults(false);
    setPane('main');
    if (blockId) {
      let tries = 0;
      const tick = () => {
        const el = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 1600);
        } else if (tries++ < 40) setTimeout(tick, 50);
      };
      tick();
    }
  }, []);

  const select = (s: Selection) => {
    setSelection(s);
    setPane('list');
    if (s.kind === 'date') setShowDateResults(true);
  };

  const inDateMode = selection.kind === 'date';
  const main = inDateMode && showDateResults ? (
    <DateFilterResults state={dateState} notes={notes} drives={drives} folders={folders} onOpenNote={openNote} />
  ) : activeNote ? (
    <>
      {inDateMode && (
        <button className="back-to-results" onClick={() => setShowDateResults(true)}>
          <Icon name="chevronLeft" size={14} /> Back to {dateState.day} results
        </button>
      )}
      <NoteEditor
        key={activeNote.id}
        note={activeNote}
        drives={drives}
        folders={folders}
        onBack={() => setPane('list')}
        onDeleted={() => setActiveNoteId(null)}
      />
    </>
  ) : (
    <div className="editor empty-state">
      <Icon name="edit" size={36} />
      <p>{notes.length ? 'Select a note or create a new one.' : 'Create your first note with “New”.'}</p>
    </div>
  );

  return (
    <div className="workspace" data-pane={pane}>
      <Sidebar drives={drives} folders={folders} notes={notes} selection={selection} onSelect={select} />
      {inDateMode ? (
        <DateFilterPanel
          state={dateState}
          onChange={(s) => {
            setDateState(s);
            setShowDateResults(true);
            setPane('main');
          }}
          notes={notes}
          drives={drives}
          folders={folders}
          onBack={() => setPane('nav')}
        />
      ) : (
        <NoteList
          notes={notes}
          drives={drives}
          folders={folders}
          selection={selection}
          activeNoteId={activeNoteId}
          onOpen={(id) => openNote(id)}
          onBack={() => setPane('nav')}
        />
      )}
      <main className="main-pane">
        {inDateMode && <button className="mobile-only back-link" onClick={() => setPane('list')}><Icon name="chevronLeft" size={14} /> Calendar</button>}
        {main}
      </main>
      {error && <div className="toast error">{error}</div>}
    </div>
  );
}
