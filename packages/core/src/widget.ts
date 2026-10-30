import { createBlock, notePreview } from './blocks';
import { newId } from './ids';
import { byOrder, ORDER_STEP } from './order';
import { rt } from './richtext';
import { formatTimestamp, relativeTime } from './time';
import type { Block, Drive, EpochMs, Folder, Note } from './types';

/**
 * Contracts between the app and the native home-screen widgets.
 *
 * App → widgets: the app writes a `WidgetSnapshot` JSON document into shared
 * storage (iOS App Group `UserDefaults`, Android `SharedPreferences`) every
 * time data changes. Widgets render exclusively from that snapshot, so they
 * work with the app closed and while offline.
 *
 * Widgets → app: Quick Capture writes `PendingCapture` items into a shared
 * queue. The app (or its headless sync task) drains the queue into the local
 * database, which then syncs to the cloud. Captures are idempotent: the note id
 * is the capture id, so draining the same item twice is harmless.
 *
 * The native implementations in `apps/mobile/targets` and
 * `apps/mobile/plugins/android-widget` mirror these types; bump
 * `WIDGET_SNAPSHOT_VERSION` whenever the shape changes.
 */

export const WIDGET_SNAPSHOT_VERSION = 1;
export const WIDGET_SNAPSHOT_KEY = 'snote.widget.snapshot';
export const WIDGET_CAPTURE_QUEUE_KEY = 'snote.widget.captures';
export const URL_SCHEME = 'snote';

export interface WidgetFolderOption {
  id: string;
  name: string;
}

export interface WidgetDriveOption {
  id: string;
  name: string;
  icon: string;
  folders: WidgetFolderOption[];
}

export interface WidgetNoteCard {
  id: string;
  title: string;
  preview: string;
  driveId: string;
  driveName: string;
  driveIcon: string;
  folderId: string;
  folderName: string;
  pinned: boolean;
  updatedAt: EpochMs;
  /** `YYYY-MM-DD HH:mm:ss` */
  updatedAtLabel: string;
  deepLink: string;
}

export interface WidgetSnapshot {
  version: number;
  generatedAt: EpochMs;
  signedIn: boolean;
  userName: string | null;
  /** Drive/Folder tree for the Quick Capture target picker. */
  targets: WidgetDriveOption[];
  /** Last Drive/Folder the user saved into — preselected in Quick Capture. */
  defaultTarget: { driveId: string; folderId: string } | null;
  /** Candidate cards for carousels, newest first. Each widget filters by its own source. */
  notes: WidgetNoteCard[];
}

/** What a carousel widget instance shows (chosen in the widget's configuration). */
export type CarouselSource =
  | { kind: 'recent' }
  | { kind: 'pinned' }
  | { kind: 'drive'; driveId: string }
  | { kind: 'folder'; folderId: string }
  | { kind: 'notes'; noteIds: string[] };

export interface PendingCapture {
  id: string;
  text: string;
  driveId: string;
  folderId: string;
  createdAt: EpochMs;
  source: 'widget' | 'shortcut' | 'app';
}

export function noteDeepLink(noteId: string): string {
  return `${URL_SCHEME}://note/${encodeURIComponent(noteId)}`;
}

export function captureDeepLink(target?: { driveId?: string; folderId?: string }): string {
  const query = Object.entries({ driveId: target?.driveId, folderId: target?.folderId })
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return `${URL_SCHEME}://capture${query ? `?${query}` : ''}`;
}

export type ParsedDeepLink =
  | { kind: 'note'; noteId: string }
  | { kind: 'capture'; driveId?: string; folderId?: string }
  | { kind: 'unknown' };

export function parseDeepLink(url: string): ParsedDeepLink {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)\/?([^?#]*)\??([^#]*)/i.exec(url);
  if (!match) return { kind: 'unknown' };
  const [, host = '', path = '', query = ''] = match;
  // Hand-rolled: React Native's URLSearchParams is incomplete on older runtimes.
  const params = new Map(
    query
      .split('&')
      .filter(Boolean)
      .map((pair) => {
        const [k = '', v = ''] = pair.split('=');
        return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' '))] as const;
      }),
  );
  if (host === 'note' && path) return { kind: 'note', noteId: decodeURIComponent(path) };
  if (host === 'capture') {
    return {
      kind: 'capture',
      driveId: params.get('driveId') ?? undefined,
      folderId: params.get('folderId') ?? undefined,
    };
  }
  return { kind: 'unknown' };
}

export interface SnapshotInput {
  drives: readonly Drive[];
  folders: readonly Folder[];
  notes: readonly Note[];
  user: { displayName: string | null } | null;
  defaultTarget?: { driveId: string; folderId: string } | null;
  now?: EpochMs;
}

export const SNAPSHOT_LIMITS = {
  recent: 50,
  perFolder: 20,
  total: 400,
  previewLength: 160,
};

/**
 * Builds the snapshot consumed by the widgets. Includes the most recent notes
 * globally, the newest notes of every folder and all pinned notes, so any
 * carousel source a user configures has content without the app running.
 */
export function buildWidgetSnapshot(input: SnapshotInput): WidgetSnapshot {
  const now = input.now ?? Date.now();
  const drives = input.drives.filter((d) => !d.deleted).sort(byOrder);
  const folders = input.folders.filter((f) => !f.deleted).sort(byOrder);
  const driveById = new Map(drives.map((d) => [d.id, d]));
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const notes = input.notes
    .filter((n) => !n.deleted && driveById.has(n.driveId) && folderById.has(n.folderId))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const chosen = new Map<string, Note>();
  for (const n of notes.slice(0, SNAPSHOT_LIMITS.recent)) chosen.set(n.id, n);
  for (const n of notes) if (n.pinned) chosen.set(n.id, n);
  const perFolder = new Map<string, number>();
  for (const n of notes) {
    const count = perFolder.get(n.folderId) ?? 0;
    if (count < SNAPSHOT_LIMITS.perFolder) chosen.set(n.id, n);
    perFolder.set(n.folderId, count + 1);
  }

  const cards = [...chosen.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, SNAPSHOT_LIMITS.total)
    .map((n): WidgetNoteCard => {
      const drive = driveById.get(n.driveId)!;
      const folder = folderById.get(n.folderId)!;
      const preview =
        n.preview.length > SNAPSHOT_LIMITS.previewLength
          ? `${n.preview.slice(0, SNAPSHOT_LIMITS.previewLength - 1)}…`
          : n.preview;
      return {
        id: n.id,
        title: n.title.trim() || 'Untitled',
        preview,
        driveId: drive.id,
        driveName: drive.name,
        driveIcon: drive.icon ?? '🗂',
        folderId: folder.id,
        folderName: folder.name,
        pinned: !!n.pinned,
        updatedAt: n.updatedAt,
        updatedAtLabel: formatTimestamp(n.updatedAt),
        deepLink: noteDeepLink(n.id),
      };
    });

  const targets = drives.map((d) => ({
    id: d.id,
    name: d.name,
    icon: d.icon ?? '🗂',
    folders: folders.filter((f) => f.driveId === d.id).map((f) => ({ id: f.id, name: f.name })),
  }));

  let defaultTarget = input.defaultTarget ?? null;
  const targetValid =
    defaultTarget &&
    folderById.get(defaultTarget.folderId)?.driveId === defaultTarget.driveId &&
    driveById.has(defaultTarget.driveId);
  if (!targetValid) {
    const firstDrive = targets.find((t) => t.folders.length > 0);
    defaultTarget = firstDrive
      ? { driveId: firstDrive.id, folderId: firstDrive.folders[0]!.id }
      : null;
  }

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: now,
    signedIn: !!input.user,
    userName: input.user?.displayName ?? null,
    targets,
    defaultTarget,
    notes: cards,
  };
}

/** Reference implementation of the carousel filter (mirrored in Swift and Kotlin). */
export function selectCarouselNotes(
  snapshot: WidgetSnapshot,
  source: CarouselSource,
  limit = 10,
): WidgetNoteCard[] {
  let cards: WidgetNoteCard[];
  switch (source.kind) {
    case 'recent':
      cards = snapshot.notes;
      break;
    case 'pinned':
      cards = snapshot.notes.filter((n) => n.pinned);
      break;
    case 'drive':
      cards = snapshot.notes.filter((n) => n.driveId === source.driveId);
      break;
    case 'folder':
      cards = snapshot.notes.filter((n) => n.folderId === source.folderId);
      break;
    case 'notes': {
      const byId = new Map(snapshot.notes.map((n) => [n.id, n]));
      cards = source.noteIds.map((id) => byId.get(id)).filter((n): n is WidgetNoteCard => !!n);
      break;
    }
  }
  return cards.slice(0, limit);
}

export function carouselLabel(snapshot: WidgetSnapshot, source: CarouselSource): string {
  switch (source.kind) {
    case 'recent':
      return 'Recently modified';
    case 'pinned':
      return 'Pinned notes';
    case 'drive':
      return snapshot.targets.find((d) => d.id === source.driveId)?.name ?? 'Drive';
    case 'folder': {
      for (const d of snapshot.targets) {
        const f = d.folders.find((x) => x.id === source.folderId);
        if (f) return `${d.name} / ${f.name}`;
      }
      return 'Folder';
    }
    case 'notes':
      return 'Selected notes';
  }
}

export function widgetUpdatedLabel(card: WidgetNoteCard, now: EpochMs = Date.now()): string {
  return relativeTime(card.updatedAt, now);
}

export function newCapture(
  text: string,
  target: { driveId: string; folderId: string },
  source: PendingCapture['source'] = 'app',
  now: EpochMs = Date.now(),
): PendingCapture {
  return { id: newId(), text, ...target, createdAt: now, source };
}

const TODO_LINE = /^\s*(?:-\s*)?\[( |x|X)?\]\s+(.*)$/;
const BULLET_LINE = /^\s*[-*•]\s+(.*)$/;

/**
 * Turns a quick capture into a note: the first line becomes the title and the
 * remaining lines become blocks (`[ ] item` → to-do, `- item` → bullet).
 * Ids are derived from the capture id so re-processing is idempotent, and all
 * timestamps use the moment of capture rather than the moment of sync.
 */
export function captureToNote(capture: PendingCapture): { note: Note; blocks: Block[] } {
  const lines = capture.text.replace(/\r\n/g, '\n').split('\n');
  while (lines.length && !lines[0]!.trim()) lines.shift();
  const title = (lines.shift() ?? '').trim().slice(0, 200);
  const location = { noteId: capture.id, driveId: capture.driveId, folderId: capture.folderId };

  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (text) push('paragraph', text);
  };
  const push = (type: 'paragraph' | 'bulleted' | 'todo', text: string, checked = false) => {
    const order = (blocks.length + 1) * ORDER_STEP;
    const id = `${capture.id}-${blocks.length}`;
    const opts = { now: capture.createdAt, id };
    blocks.push(
      type === 'todo'
        ? createBlock('todo', location, order, { ...opts, data: { text: rt(text), checked } })
        : createBlock(type, location, order, { ...opts, data: { text: rt(text) } }),
    );
  };

  for (const line of lines) {
    const todo = TODO_LINE.exec(line);
    const bullet = todo ? null : BULLET_LINE.exec(line);
    if (todo) {
      flush();
      push('todo', todo[2] ?? '', (todo[1] ?? ' ').toLowerCase() === 'x');
    } else if (bullet) {
      flush();
      push('bulleted', bullet[1] ?? '');
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  if (blocks.length === 0) push('paragraph', '');

  const note: Note = {
    id: capture.id,
    driveId: capture.driveId,
    folderId: capture.folderId,
    title,
    preview: notePreview(blocks),
    createdAt: capture.createdAt,
    updatedAt: capture.createdAt,
  };
  return { note, blocks };
}
