'use client';

import type { Drive, Folder, Note } from '@snote/core';
import { useState } from 'react';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { AppDownloadButton } from './AppDownload';
import { Icon } from './Icon';

export type Selection =
  | { kind: 'recent' }
  | { kind: 'pinned' }
  | { kind: 'drive'; driveId: string }
  | { kind: 'folder'; driveId: string; folderId: string }
  | { kind: 'date' };

const DRIVE_ICONS = ['🗂', '🏠', '💼', '🎓', '💡', '📚', '🧪', '✈️', '❤️', '🎵'];

export function Sidebar({
  drives,
  folders,
  notes,
  selection,
  onSelect,
}: {
  drives: Drive[];
  folders: Folder[];
  notes: Note[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const { service, user, mode, status, signOut } = useSession();
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  if (!service) return null;

  const countIn = (folderId: string) => notes.filter((n) => n.folderId === folderId).length;
  const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(selection);

  const rename = (kind: 'drive' | 'folder', id: string, name: string) => {
    setEditing(null);
    if (!name.trim()) return;
    if (kind === 'drive') service.updateDrive(id, { name: name.trim() });
    else service.updateFolder(id, { name: name.trim() });
  };

  const syncLabel = !status.online ? 'Offline — changes saved locally' : status.pendingWrites ? 'Syncing…' : mode === 'local' ? 'Local only (this browser)' : 'All changes synced';

  return (
    <nav className="sidebar" aria-label="Drives and folders">
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark">S</span> SNote
        </div>
        <button className="icon-btn ghost" onClick={theme.cycle} title={`Theme: ${theme.pref}`}>
          <Icon name={theme.pref === 'dark' ? 'moon' : theme.pref === 'light' ? 'sun' : 'monitor'} />
        </button>
      </div>

      <div className="nav-section">
        <button className={`nav-item${isSel({ kind: 'recent' }) ? ' active' : ''}`} onClick={() => onSelect({ kind: 'recent' })}>
          <Icon name="clock" /> Recently modified
        </button>
        <button className={`nav-item${isSel({ kind: 'pinned' }) ? ' active' : ''}`} onClick={() => onSelect({ kind: 'pinned' })}>
          <Icon name="pin" /> Pinned
        </button>
        <button className={`nav-item${selection.kind === 'date' ? ' active' : ''}`} onClick={() => onSelect({ kind: 'date' })}>
          <Icon name="calendar" /> Filter by date
        </button>
      </div>

      <div className="nav-heading">
        <span>Drives</span>
        <button
          className="icon-btn ghost small"
          title="New drive"
          onClick={() => {
            const d = service.createDrive('New Drive', DRIVE_ICONS[drives.length % DRIVE_ICONS.length]);
            setEditing(d.id);
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="tree">
        {drives.map((drive) => {
          const driveFolders = folders.filter((f) => f.driveId === drive.id);
          const open = !collapsed[drive.id];
          return (
            <div key={drive.id} className="tree-drive">
              <div className={`nav-item drive${isSel({ kind: 'drive', driveId: drive.id }) ? ' active' : ''}`}>
                <button className="twisty" onClick={() => setCollapsed((c) => ({ ...c, [drive.id]: open }))} aria-label={open ? 'Collapse' : 'Expand'}>
                  <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
                </button>
                <span className="drive-icon">{drive.icon}</span>
                {editing === drive.id ? (
                  <input
                    autoFocus
                    defaultValue={drive.name}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => rename('drive', drive.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                ) : (
                  <button className="nav-label" onClick={() => onSelect({ kind: 'drive', driveId: drive.id })} onDoubleClick={() => setEditing(drive.id)}>
                    {drive.name}
                  </button>
                )}
                <button className="icon-btn ghost small row-action" title="Drive options" onClick={() => setMenu(menu === drive.id ? null : drive.id)}>
                  <Icon name="more" size={14} />
                </button>
                {menu === drive.id && (
                  <div className="menu row-menu" onMouseLeave={() => setMenu(null)}>
                    <button className="menu-item" onClick={() => { setMenu(null); const f = service.createFolder(drive.id, 'New Folder'); setEditing(f.id); setCollapsed((c) => ({ ...c, [drive.id]: false })); }}>
                      <Icon name="folder" /> New folder
                    </button>
                    <button className="menu-item" onClick={() => { setMenu(null); setEditing(drive.id); }}>
                      <Icon name="edit" /> Rename
                    </button>
                    <div className="icon-picker">
                      {DRIVE_ICONS.map((i) => (
                        <button key={i} onClick={() => { service.updateDrive(drive.id, { icon: i }); setMenu(null); }}>{i}</button>
                      ))}
                    </div>
                    <button
                      className="menu-item danger"
                      onClick={() => {
                        setMenu(null);
                        if (confirm(`Delete drive "${drive.name}" with all its folders and notes?`)) {
                          void service.deleteDrive(drive.id);
                          if ('driveId' in selection && selection.driveId === drive.id) onSelect({ kind: 'recent' });
                        }
                      }}
                    >
                      <Icon name="trash" /> Delete drive
                    </button>
                  </div>
                )}
              </div>
              {open && (
                <div className="tree-folders">
                  {driveFolders.map((folder) => (
                    <div key={folder.id} className={`nav-item folder${isSel({ kind: 'folder', driveId: drive.id, folderId: folder.id }) ? ' active' : ''}`}>
                      <Icon name="folder" size={14} />
                      {editing === folder.id ? (
                        <input
                          autoFocus
                          defaultValue={folder.name}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => rename('folder', folder.id, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                      ) : (
                        <button
                          className="nav-label"
                          onClick={() => onSelect({ kind: 'folder', driveId: drive.id, folderId: folder.id })}
                          onDoubleClick={() => setEditing(folder.id)}
                        >
                          {folder.name}
                        </button>
                      )}
                      <span className="count">{countIn(folder.id) || ''}</span>
                      <button className="icon-btn ghost small row-action" title="Folder options" onClick={() => setMenu(menu === folder.id ? null : folder.id)}>
                        <Icon name="more" size={14} />
                      </button>
                      {menu === folder.id && (
                        <div className="menu row-menu" onMouseLeave={() => setMenu(null)}>
                          <button className="menu-item" onClick={() => { setMenu(null); setEditing(folder.id); }}>
                            <Icon name="edit" /> Rename
                          </button>
                          <button
                            className="menu-item danger"
                            onClick={() => {
                              setMenu(null);
                              if (confirm(`Delete folder "${folder.name}" and its notes?`)) {
                                void service.deleteFolder(folder.id);
                                if ('folderId' in selection && selection.folderId === folder.id) onSelect({ kind: 'drive', driveId: drive.id });
                              }
                            }}
                          >
                            <Icon name="trash" /> Delete folder
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    className="nav-item add-folder"
                    onClick={() => {
                      const f = service.createFolder(drive.id, 'New Folder');
                      setEditing(f.id);
                    }}
                  >
                    <Icon name="plus" size={12} /> Add folder
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <AppDownloadButton />
        <div className={`sync-pill${!status.online ? ' offline' : status.pendingWrites ? ' pending' : ''}`} title={status.error ?? syncLabel}>
          <Icon name={!status.online ? 'cloudOff' : status.pendingWrites ? 'sync' : 'cloud'} size={14} />
          <span>{syncLabel}</span>
        </div>
        <div className="account">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar placeholder">{(user?.displayName ?? 'L')[0]}</span>
          )}
          <span className="account-name">{user?.displayName ?? user?.email ?? 'Local workspace'}</span>
          <button className="icon-btn ghost small" title={mode === 'local' ? 'Leave local mode' : 'Sign out'} onClick={() => void signOut()}>
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}
