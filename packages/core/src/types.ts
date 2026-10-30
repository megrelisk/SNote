/**
 * SNote domain model.
 *
 * Hierarchy: Drive → Folder → Note → Block.
 * Every entity is stored as its own document so that edits stay granular
 * (two devices editing different blocks of the same note never conflict)
 * and so that blocks can be queried by date across the whole account.
 */

/** Milliseconds since the Unix epoch. Formatted for display with `formatTimestamp`. */
export type EpochMs = number;

/** Local calendar day in `YYYY-MM-DD` form, used for date filtering. */
export type DayKey = string;

export interface BaseEntity {
  id: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  /** Soft-delete marker so deletions propagate to offline devices. */
  deleted?: boolean;
}

export interface Drive extends BaseEntity {
  name: string;
  /** Emoji or short glyph shown next to the drive name. */
  icon?: string;
  order: number;
}

export interface Folder extends BaseEntity {
  driveId: string;
  name: string;
  order: number;
}

export interface Note extends BaseEntity {
  driveId: string;
  folderId: string;
  title: string;
  /** Plain-text preview of the most recently edited block (widgets + note list). */
  preview: string;
  pinned?: boolean;
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

export type Mark = 'bold' | 'italic' | 'underline' | 'code' | 'strike';

/** A run of text sharing the same inline marks. */
export interface Span {
  text: string;
  marks?: Mark[];
  /** Optional hyperlink target. */
  href?: string;
}

export type RichText = Span[];

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo'
  | 'code'
  | 'image'
  | 'file'
  | 'table';

export interface TextBlockData {
  text: RichText;
}

export interface TodoBlockData {
  text: RichText;
  checked: boolean;
}

export interface CodeBlockData {
  code: string;
  language?: string;
}

export interface MediaRef {
  /** Remote download URL once uploaded; empty while the upload is pending. */
  url: string;
  /** Storage path (`snote/users/{uid}/attachments/...`). */
  storagePath: string;
  name: string;
  mimeType: string;
  size: number;
  /** Local URI / object URL used while offline or before the upload completes. */
  localUri?: string;
}

export interface ImageBlockData {
  image: MediaRef | null;
  caption?: string;
  width?: number;
  height?: number;
}

export interface FileBlockData {
  file: MediaRef | null;
}

export interface TableBlockData {
  /** Row-major grid of plain-text cells. `rows[0]` is the header row when `header` is true. */
  rows: string[][];
  header: boolean;
}

export interface BlockDataMap {
  paragraph: TextBlockData;
  heading1: TextBlockData;
  heading2: TextBlockData;
  heading3: TextBlockData;
  bulleted: TextBlockData;
  numbered: TextBlockData;
  todo: TodoBlockData;
  code: CodeBlockData;
  image: ImageBlockData;
  file: FileBlockData;
  table: TableBlockData;
}

export interface BlockOf<T extends BlockType> extends BaseEntity {
  noteId: string;
  /** Denormalised so date-filter results can be grouped without extra reads. */
  driveId: string;
  folderId: string;
  type: T;
  data: BlockDataMap[T];
  /** Fractional sort key within the note. */
  order: number;
  /**
   * Every local day on which this block was created or modified.
   * Indexed with `array-contains` so "show me everything I touched on day X"
   * is a single query, even for blocks that were edited again later.
   */
  activityDays: DayKey[];
}

export type Block = { [T in BlockType]: BlockOf<T> }[BlockType];

export type TextLikeBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulleted'
  | 'numbered'
  | 'todo';

export const TEXT_LIKE_TYPES: readonly TextLikeBlockType[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulleted',
  'numbered',
  'todo',
];

export type TextLikeBlock = Extract<Block, { type: TextLikeBlockType }>;

export function isTextLike(block: Block): block is TextLikeBlock {
  return (TEXT_LIKE_TYPES as readonly string[]).includes(block.type);
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
