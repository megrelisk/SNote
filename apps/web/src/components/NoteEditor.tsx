'use client';

import {
  blocksToMarkdown,
  convertBlock,
  formatTimestamp,
  isTextLike,
  richText,
  type Block,
  type BlockDataMap,
  type BlockType,
  type Drive,
  type Folder,
  type Mark,
  type Note,
} from '@snote/core';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback, useNoteBlocks } from '@/lib/hooks';
import { setSelectionOffsets } from '@/lib/richDom';
import { useSession } from '@/lib/session';
import { uploadAttachment } from '@/lib/uploads';
import { BLOCK_DRAG_TYPE, BlockRow } from './BlockRow';
import { textControllers } from './blocks/TextBlock';
import { EditorContext, type EditorApi, type FocusTarget } from './editorContext';
import { Icon } from './Icon';

interface MenuState {
  blockId: string;
  mode: 'slash' | 'handle' | 'add';
  query: string;
}

export function NoteEditor({
  note,
  drives,
  folders,
  onBack,
  onDeleted,
}: {
  note: Note;
  drives: Drive[];
  folders: Folder[];
  onBack?: () => void;
  onDeleted: () => void;
}) {
  const { service, user } = useSession();
  const { items: blocks, loading } = useNoteBlocks(note.id);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [title, setTitle] = useState(note.title);
  const titleFocused = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!titleFocused.current) setTitle(note.title);
  }, [note.title]);

  const titleSaver = useDebouncedCallback((value: string) => service!.updateNote(note.id, { title: value }), 400);
  useEffect(() => () => titleSaver.flush(), [titleSaver]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  // Apply focus requests once the target block has rendered.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const row = document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(target.blockId)}"]`);
    const el = row?.querySelector<HTMLElement>('[data-editable]');
    if (!el) return;
    pendingFocus.current = null;
    el.focus({ preventScroll: false });
    if (el.isContentEditable) {
      const len = el.textContent?.length ?? 0;
      const offset = target.offset === 'start' ? 0 : target.offset === 'end' ? len : Math.min(target.offset, len);
      setSelectionOffsets(el, offset);
    } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const pos = target.offset === 'start' ? 0 : el.value.length;
      el.setSelectionRange(pos, pos);
    }
    el.scrollIntoView({ block: 'nearest' });
  }, [blocks, focusTick]);

  const api = useMemo<EditorApi | null>(() => {
    if (!service) return null;
    const siblings = () => blocksRef.current;
    const focus = (target: FocusTarget) => {
      pendingFocus.current = target;
      setFocusTick((t) => t + 1);
    };
    const neighbour = (block: Block, delta: number) => {
      const list = siblings();
      const i = list.findIndex((b) => b.id === block.id);
      return i >= 0 ? list[i + delta] : undefined;
    };
    const insertAfter = <T extends BlockType>(block: Block | null, type: T, data?: BlockDataMap[T]): Block => {
      const created = service.insertBlock(note, siblings(), type, { afterId: block?.id, data });
      blocksRef.current = [...siblings(), created as Block];
      return created as Block;
    };
    const api: EditorApi = {
      note,
      blocks,
      service,
      uid: user?.uid ?? null,
      save: (block) => {
        const saved = service.saveBlock(block, siblings());
        blocksRef.current = siblings().map((b) => (b.id === saved.id ? saved : b));
      },
      focus,
      split: (block, left, right) => {
        const saved = service.saveBlock({ ...block, data: { ...block.data, text: left } } as Block, siblings());
        blocksRef.current = siblings().map((b) => (b.id === saved.id ? saved : b));
        const keepType = block.type === 'bulleted' || block.type === 'numbered' || block.type === 'todo';
        const created = keepType
          ? block.type === 'todo'
            ? insertAfter(block, 'todo', { text: right, checked: false })
            : insertAfter(block, block.type, { text: right })
          : insertAfter(block, 'paragraph', { text: right });
        focus({ blockId: created.id, offset: 'start' });
      },
      mergeBackward: (block, current) => {
        if (block.type !== 'paragraph') {
          api.convert(block, 'paragraph', block.type === 'code' || isTextLike(block) ? current : []);
          return;
        }
        const prev = neighbour(block, -1);
        if (!prev) return;
        if (isTextLike(prev)) {
          const joinAt = richText.plainText(prev.data.text).length;
          api.save({ ...prev, data: { ...prev.data, text: richText.concat(prev.data.text, current) } } as Block);
          service.deleteBlock(block, siblings());
          blocksRef.current = siblings().filter((b) => b.id !== block.id);
          focus({ blockId: prev.id, offset: joinAt });
        } else if (richText.plainText(current) === '') {
          service.deleteBlock(block, siblings());
          setSelected(prev.id);
        } else {
          setSelected(prev.id);
        }
      },
      navigate: (block, direction) => {
        const next = neighbour(block, direction === 'up' ? -1 : 1);
        if (next) focus({ blockId: next.id, offset: direction === 'up' ? 'end' : 'start' });
      },
      insertAfter,
      convert: (block, type, text) => {
        // Take over the block's unsaved keystrokes, then drop its queued save so it
        // cannot resurrect the old type/text afterwards.
        const controller = textControllers.get(block.id);
        if (text === undefined && controller) text = controller.currentText();
        controller?.discardPending();
        let next = convertBlock(block, type);
        if (text !== undefined && isTextLike(next)) next = { ...next, data: { ...next.data, text } } as Block;
        api.save(next);
        if (isTextLike(next)) textControllers.get(block.id)?.setText(next.data.text);
        focus({ blockId: block.id, offset: 'start' });
      },
      remove: (block) => {
        const prev = neighbour(block, -1) ?? neighbour(block, 1);
        service.deleteBlock(block, siblings());
        blocksRef.current = siblings().filter((b) => b.id !== block.id);
        if (prev) focus({ blockId: prev.id, offset: 'end' });
      },
      openMenu: (blockId, mode, query = '') => setMenu(blockId ? { blockId, mode, query } : null),
      attachFiles: (files, after) => {
        let anchor = after;
        for (const file of files) {
          const type = file.type.startsWith('image/') ? 'image' : 'file';
          const created = insertAfter(anchor, type);
          anchor = created;
          uploadAttachment(file, created.id, user?.uid ?? null)
            .then((media) => {
              const current = blocksRef.current.find((b) => b.id === created.id) ?? created;
              api.save(
                (type === 'image'
                  ? { ...current, data: { image: media } }
                  : { ...current, data: { file: media } }) as Block,
              );
            })
            .catch((e) => alert(e instanceof Error ? e.message : String(e)));
        }
      },
      numberFor: (block) => {
        const list = siblings();
        let n = 0;
        for (let i = list.findIndex((b) => b.id === block.id); i >= 0 && list[i]!.type === 'numbered'; i--) n++;
        return Math.max(1, n);
      },
    };
    return api;
  }, [service, note, blocks, user]);

  // Floating inline-format bar for text selections.
  const [formatBar, setFormatBar] = useState<{ top: number; left: number; blockId: string } | null>(null);
  useEffect(() => {
    const onSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return setFormatBar(null);
      const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const editable = node?.closest<HTMLElement>('.editable');
      const row = editable?.closest<HTMLElement>('[data-block-id]');
      if (!editable || !row) return setFormatBar(null);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setFormatBar({ top: rect.top - 44, left: rect.left + rect.width / 2, blockId: row.dataset.blockId! });
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  const onDropRow = useCallback(
    (e: React.DragEvent, targetId: string, position: 'before' | 'after') => {
      setDrop(null);
      if (!api) return;
      const list = blocksRef.current;
      const target = list.find((b) => b.id === targetId);
      if (e.dataTransfer.files.length) {
        e.preventDefault();
        const anchor = position === 'after' ? target ?? null : list[list.findIndex((b) => b.id === targetId) - 1] ?? null;
        api.attachFiles(Array.from(e.dataTransfer.files), anchor);
        return;
      }
      const draggedId = e.dataTransfer.getData(BLOCK_DRAG_TYPE);
      const dragged = list.find((b) => b.id === draggedId);
      if (!dragged || !target || dragged.id === target.id) return;
      e.preventDefault();
      const rest = list.filter((b) => b.id !== dragged.id);
      const index = rest.findIndex((b) => b.id === target.id) + (position === 'after' ? 1 : 0);
      service!.moveBlock(dragged, list, index);
    },
    [api, service],
  );

  const onDragOverRow = useCallback((id: string, position: 'before' | 'after') => {
    setDrop((d) => (d?.id === id && d.position === position ? d : { id, position }));
  }, []);
  const onDragEnd = useCallback(() => setDrop(null), []);

  if (!api || !service) return null;

  const drive = drives.find((d) => d.id === note.driveId);
  const folder = folders.find((f) => f.id === note.folderId);

  const appendBlock = () => {
    const last = blocks[blocks.length - 1];
    if (last && isTextLike(last) && richText.plainText(last.data.text) === '') {
      api.focus({ blockId: last.id, offset: 'start' });
    } else {
      api.focus({ blockId: api.insertAfter(null, 'paragraph').id, offset: 'start' });
    }
  };

  return (
    <EditorContext.Provider value={api}>
      <div
        className="editor"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (e.defaultPrevented || !e.dataTransfer.files.length) return;
          e.preventDefault();
          api.attachFiles(Array.from(e.dataTransfer.files), blocks[blocks.length - 1] ?? null);
        }}
      >
        <header className="editor-header">
          {onBack && (
            <button className="icon-btn ghost mobile-only" onClick={onBack} aria-label="Back to notes">
              <Icon name="chevronLeft" />
            </button>
          )}
          <label className="breadcrumb" title="Move note">
            <span>{drive?.icon}</span>
            <select
              value={`${note.driveId}/${note.folderId}`}
              onChange={(e) => {
                const [driveId, folderId] = e.target.value.split('/');
                void service.moveNote(note, { driveId: driveId!, folderId: folderId! });
              }}
            >
              {drives.map((d) => (
                <optgroup key={d.id} label={d.name}>
                  {folders
                    .filter((f) => f.driveId === d.id)
                    .map((f) => (
                      <option key={f.id} value={`${d.id}/${f.id}`}>
                        {d.name} / {f.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <span className="breadcrumb-text">
              {drive?.name ?? '—'} <Icon name="chevronRight" size={12} /> {folder?.name ?? '—'}
            </span>
          </label>
          <div className="spacer" />
          <button
            className={`icon-btn ghost${note.pinned ? ' active' : ''}`}
            title={note.pinned ? 'Unpin (widgets)' : 'Pin to widgets'}
            onClick={() => service.updateNote(note.id, { pinned: !note.pinned })}
          >
            <Icon name="pin" />
          </button>
          <button
            className="icon-btn ghost"
            title="Copy as Markdown"
            onClick={() => void navigator.clipboard?.writeText(`# ${note.title}\n\n${blocksToMarkdown(blocks)}`)}
          >
            <Icon name="file" />
          </button>
          <button
            className="icon-btn ghost danger"
            title="Delete note"
            onClick={() => {
              if (confirm(`Delete "${note.title || 'Untitled'}"? This syncs to all your devices.`)) {
                void service.deleteNote(note.id).then(onDeleted);
              }
            }}
          >
            <Icon name="trash" />
          </button>
        </header>

        <div className="editor-scroll" onClick={(e) => e.target === e.currentTarget && appendBlock()}>
          <div className="editor-page">
            <textarea
              ref={titleRef}
              className="note-title"
              placeholder="Untitled"
              rows={1}
              value={title}
              onFocus={() => (titleFocused.current = true)}
              onBlur={() => {
                titleFocused.current = false;
                titleSaver.flush();
              }}
              onChange={(e) => {
                setTitle(e.target.value.replace(/\n/g, ''));
                titleSaver.call(e.target.value.replace(/\n/g, ''));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || (e.key === 'ArrowDown' && blocks[0])) {
                  e.preventDefault();
                  titleSaver.flush();
                  if (blocks[0]) api.focus({ blockId: blocks[0].id, offset: 'start' });
                  else appendBlock();
                }
              }}
            />
            <div className="note-meta">
              Created {formatTimestamp(note.createdAt)} · Edited {formatTimestamp(note.updatedAt)}
            </div>

            <div className="blocks" onMouseLeave={() => setDrop(null)}>
              {blocks.map((block, index) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  index={index}
                  menu={menu?.blockId === block.id ? menu.mode : null}
                  menuQuery={menu?.blockId === block.id ? menu.query : ''}
                  selected={selected === block.id}
                  dropPosition={drop?.id === block.id ? drop.position : null}
                  onSelect={setSelected}
                  onDragOverRow={onDragOverRow}
                  onDropRow={onDropRow}
                  onDragEnd={onDragEnd}
                />
              ))}
              {!loading && (
                <button className="add-block" onClick={appendBlock}>
                  <Icon name="plus" /> Add a block
                </button>
              )}
            </div>
          </div>
        </div>

        {formatBar && (
          <div
            className="format-bar"
            style={{ top: Math.max(8, formatBar.top), left: formatBar.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {(
              [
                ['bold', 'bold', 'Bold (Ctrl+B)'],
                ['italic', 'italic', 'Italic (Ctrl+I)'],
                ['underline', 'underline', 'Underline (Ctrl+U)'],
                ['strike', 'strike', 'Strikethrough (Ctrl+Shift+S)'],
                ['code', 'code', 'Inline code (Ctrl+E)'],
              ] as [Mark, Parameters<typeof Icon>[0]['name'], string][]
            ).map(([mark, icon, label]) => (
              <button key={mark} title={label} onClick={() => textControllers.get(formatBar.blockId)?.toggle(mark)}>
                <Icon name={icon} />
              </button>
            ))}
          </div>
        )}
      </div>
    </EditorContext.Provider>
  );
}

