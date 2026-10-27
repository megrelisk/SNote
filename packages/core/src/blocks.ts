import { newId } from './ids';
import { plainText, rt } from './richtext';
import { dayKey, withActivityDay } from './time';
import type {
  Block,
  BlockDataMap,
  BlockOf,
  BlockType,
  EpochMs,
  Note,
  RichText,
} from './types';
import { isTextLike, TEXT_LIKE_TYPES } from './types';

export interface BlockLocation {
  noteId: string;
  driveId: string;
  folderId: string;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: 'Text',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulleted: 'Bulleted list',
  numbered: 'Numbered list',
  todo: 'To-do',
  code: 'Code',
  image: 'Image',
  file: 'File',
  table: 'Table',
};

export function defaultBlockData<T extends BlockType>(type: T): BlockDataMap[T] {
  const data: { [K in BlockType]: BlockDataMap[K] } = {
    paragraph: { text: [] },
    heading1: { text: [] },
    heading2: { text: [] },
    heading3: { text: [] },
    bulleted: { text: [] },
    numbered: { text: [] },
    todo: { text: [], checked: false },
    code: { code: '' },
    image: { image: null },
    file: { file: null },
    table: {
      header: true,
      rows: [
        ['', '', ''],
        ['', '', ''],
      ],
    },
  };
  return data[type];
}

export function createBlock<T extends BlockType>(
  type: T,
  location: BlockLocation,
  order: number,
  options: { data?: BlockDataMap[T]; now?: EpochMs; id?: string } = {},
): BlockOf<T> {
  const now = options.now ?? Date.now();
  return {
    id: options.id ?? newId(),
    ...location,
    type,
    data: options.data ?? defaultBlockData(type),
    order,
    createdAt: now,
    updatedAt: now,
    activityDays: [dayKey(now)],
  };
}

/**
 * Returns a copy of the block with `patch` applied and its timestamps bumped:
 * `updatedAt` becomes `now` and the current day is recorded in `activityDays`.
 */
export function touchBlock<B extends Block>(block: B, patch: Partial<B>, now: EpochMs = Date.now()): B {
  return {
    ...block,
    ...patch,
    updatedAt: now,
    activityDays: withActivityDay(block.activityDays ?? [], dayKey(now)),
  };
}

export function blockRichText(block: Block): RichText | null {
  return isTextLike(block) ? block.data.text : null;
}

/** Searchable / previewable plain text for any block type. */
export function blockPlainText(block: Block): string {
  switch (block.type) {
    case 'code':
      return block.data.code;
    case 'image':
      return block.data.caption || (block.data.image ? `🖼 ${block.data.image.name}` : '');
    case 'file':
      return block.data.file ? `📎 ${block.data.file.name}` : '';
    case 'table':
      return block.data.rows
        .map((r) => r.filter(Boolean).join(' · '))
        .filter(Boolean)
        .join(' / ');
    case 'todo':
      return `${block.data.checked ? '☑' : '☐'} ${plainText(block.data.text)}`.trim();
    default:
      return plainText(block.data.text);
  }
}

export function isBlockEmpty(block: Block): boolean {
  switch (block.type) {
    case 'image':
      return !block.data.image;
    case 'file':
      return !block.data.file;
    case 'table':
      return block.data.rows.every((r) => r.every((c) => !c));
    case 'code':
      return !block.data.code;
    default:
      return plainText(block.data.text).trim() === '';
  }
}

/**
 * Converts a block to another type, carrying over its text where possible
 * (e.g. paragraph → heading, to-do → bullet, code ↔ text).
 */
export function convertBlock(block: Block, type: BlockType, now: EpochMs = Date.now()): Block {
  if (block.type === type) return block;
  let text: RichText = [];
  if (isTextLike(block)) text = block.data.text;
  else if (block.type === 'code') text = rt(block.data.code);

  let data: BlockDataMap[BlockType];
  if ((TEXT_LIKE_TYPES as readonly string[]).includes(type)) {
    data = type === 'todo' ? { text, checked: false } : { text };
  } else if (type === 'code') {
    data = { code: plainText(text) };
  } else {
    data = defaultBlockData(type);
  }
  return touchBlock({ ...block, type, data } as Block, {}, now);
}

/** Plain-text preview of the most recently edited non-empty block (shown in lists and widgets). */
export function notePreview(blocks: readonly Block[], maxLength = 160): string {
  const latest = blocks
    .filter((b) => !b.deleted && !isBlockEmpty(b))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (!latest) return '';
  const text = blockPlainText(latest).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function noteDisplayTitle(note: Pick<Note, 'title'>): string {
  return note.title.trim() || 'Untitled';
}

/** Markdown export of a block list (used for copy / share). */
export function blocksToMarkdown(blocks: readonly Block[]): string {
  let numbered = 0;
  return blocks
    .map((b) => {
      if (b.type !== 'numbered') numbered = 0;
      switch (b.type) {
        case 'heading1':
          return `# ${plainText(b.data.text)}`;
        case 'heading2':
          return `## ${plainText(b.data.text)}`;
        case 'heading3':
          return `### ${plainText(b.data.text)}`;
        case 'bulleted':
          return `- ${plainText(b.data.text)}`;
        case 'numbered':
          numbered += 1;
          return `${numbered}. ${plainText(b.data.text)}`;
        case 'todo':
          return `- [${b.data.checked ? 'x' : ' '}] ${plainText(b.data.text)}`;
        case 'code':
          return '```' + (b.data.language ?? '') + '\n' + b.data.code + '\n```';
        case 'image':
          return b.data.image ? `![${b.data.caption ?? b.data.image.name}](${b.data.image.url})` : '';
        case 'file':
          return b.data.file ? `[${b.data.file.name}](${b.data.file.url})` : '';
        case 'table': {
          const [head, ...rest] = b.data.rows;
          if (!head) return '';
          const line = (r: string[]) => `| ${r.join(' | ')} |`;
          return [line(head), line(head.map(() => '---')), ...rest.map(line)].join('\n');
        }
        default:
          return plainText(b.data.text);
      }
    })
    .join('\n\n');
}
