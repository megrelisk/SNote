import type { Mark, RichText, Span } from './types';

/**
 * Rich text is stored as a flat list of spans (text + inline marks).
 * The same representation drives the web contentEditable editor and the
 * mobile TextInput editor, so all editing operations live here.
 */

const MARK_ORDER: Mark[] = ['bold', 'italic', 'underline', 'strike', 'code'];

function sortMarks(marks: readonly Mark[] | undefined): Mark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  const unique = MARK_ORDER.filter((m) => marks.includes(m));
  return unique.length ? unique : undefined;
}

function sameFormat(a: Span, b: Span): boolean {
  const am = sortMarks(a.marks) ?? [];
  const bm = sortMarks(b.marks) ?? [];
  return a.href === b.href && am.length === bm.length && am.every((m, i) => m === bm[i]);
}

function makeSpan(text: string, marks?: readonly Mark[], href?: string): Span {
  const span: Span = { text };
  const sorted = sortMarks(marks);
  if (sorted) span.marks = sorted;
  if (href) span.href = href;
  return span;
}

export function rt(text = ''): RichText {
  return text ? [{ text }] : [];
}

export function plainText(value: RichText): string {
  return value.map((s) => s.text).join('');
}

/** Merges adjacent spans with identical formatting and removes empty spans. */
export function normalize(value: RichText): RichText {
  const out: Span[] = [];
  for (const span of value) {
    if (!span.text) continue;
    const last = out[out.length - 1];
    if (last && sameFormat(last, span)) {
      out[out.length - 1] = makeSpan(last.text + span.text, last.marks, last.href);
    } else {
      out.push(makeSpan(span.text, span.marks, span.href));
    }
  }
  return out;
}

/** Returns the spans covering the half-open character range [start, end). */
export function slice(value: RichText, start: number, end = Infinity): RichText {
  const out: Span[] = [];
  let pos = 0;
  for (const span of value) {
    const spanStart = pos;
    const spanEnd = pos + span.text.length;
    pos = spanEnd;
    const from = Math.max(start, spanStart);
    const to = Math.min(end, spanEnd);
    if (from < to) {
      out.push(makeSpan(span.text.slice(from - spanStart, to - spanStart), span.marks, span.href));
    }
  }
  return normalize(out);
}

export function concat(...parts: RichText[]): RichText {
  return normalize(parts.flat());
}

/** Splits rich text at a character offset (used when Enter splits a block in two). */
export function splitAt(value: RichText, offset: number): [RichText, RichText] {
  return [slice(value, 0, offset), slice(value, offset)];
}

/** Marks active at a caret position: those of the character just before it (or after it at offset 0). */
export function marksAt(value: RichText, offset: number): Mark[] {
  let pos = 0;
  for (const span of value) {
    const end = pos + span.text.length;
    if (offset > pos && offset <= end) return [...(span.marks ?? [])];
    pos = end;
  }
  const first = value[0];
  return offset === 0 && first ? [...(first.marks ?? [])] : [];
}

/** True when every character in [start, end) carries `mark`. */
export function rangeHasMark(value: RichText, start: number, end: number, mark: Mark): boolean {
  if (start >= end) return marksAt(value, start).includes(mark);
  const part = slice(value, start, end);
  return part.length > 0 && part.every((s) => s.marks?.includes(mark));
}

function mapRange(
  value: RichText,
  start: number,
  end: number,
  fn: (span: Span) => Span,
): RichText {
  const before = slice(value, 0, start);
  const middle = slice(value, start, end).map(fn);
  const after = slice(value, end);
  return concat(before, middle, after);
}

export function addMark(value: RichText, start: number, end: number, mark: Mark): RichText {
  return mapRange(value, start, end, (s) => makeSpan(s.text, [...(s.marks ?? []), mark], s.href));
}

export function removeMark(value: RichText, start: number, end: number, mark: Mark): RichText {
  return mapRange(value, start, end, (s) =>
    makeSpan(
      s.text,
      (s.marks ?? []).filter((m) => m !== mark),
      s.href,
    ),
  );
}

/** Toggles a mark over a selection: removes it if the whole range has it, otherwise adds it. */
export function toggleMark(value: RichText, start: number, end: number, mark: Mark): RichText {
  return rangeHasMark(value, start, end, mark)
    ? removeMark(value, start, end, mark)
    : addMark(value, start, end, mark);
}

export function setLink(value: RichText, start: number, end: number, href: string | null): RichText {
  return mapRange(value, start, end, (s) => makeSpan(s.text, s.marks, href ?? undefined));
}

/**
 * Applies a plain-text edit (as produced by a native TextInput) to rich text,
 * preserving formatting of untouched characters. Inserted characters inherit
 * the marks at the insertion point, or `pendingMarks` when provided (e.g. the
 * user tapped "Bold" with a collapsed caret before typing).
 */
export function applyTextEdit(
  value: RichText,
  nextText: string,
  pendingMarks?: readonly Mark[],
): RichText {
  const prevText = plainText(value);
  if (prevText === nextText) return value;

  let prefix = 0;
  const maxPrefix = Math.min(prevText.length, nextText.length);
  while (prefix < maxPrefix && prevText[prefix] === nextText[prefix]) prefix++;

  let suffix = 0;
  const maxSuffix = Math.min(prevText.length, nextText.length) - prefix;
  while (
    suffix < maxSuffix &&
    prevText[prevText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const removedEnd = prevText.length - suffix;
  const inserted = nextText.slice(prefix, nextText.length - suffix);

  let insertedSpan: Span | null = null;
  if (inserted) {
    const marks = pendingMarks ?? marksAt(value, prefix);
    const hrefSource = slice(value, Math.max(0, prefix - 1), prefix)[0];
    insertedSpan = makeSpan(inserted, marks, hrefSource?.href);
  }

  return concat(slice(value, 0, prefix), insertedSpan ? [insertedSpan] : [], slice(value, removedEnd));
}

// ---------------------------------------------------------------------------
// HTML serialisation (web rendering + clipboard). Parsing lives in the web app
// because it needs a DOM.
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MARK_TAG: Record<Mark, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};

export function toHtml(value: RichText): string {
  return value
    .map((span) => {
      let html = escapeHtml(span.text).replace(/\n/g, '<br>');
      for (const mark of sortMarks(span.marks) ?? []) {
        const tag = MARK_TAG[mark];
        html = `<${tag}>${html}</${tag}>`;
      }
      if (span.href && /^(https?:|mailto:)/i.test(span.href)) {
        html = `<a href="${escapeHtml(span.href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      }
      return html;
    })
    .join('');
}

/** Converts an inline HTML tag name to a mark (used by the web DOM parser). */
export function markForTag(tag: string): Mark | null {
  switch (tag.toLowerCase()) {
    case 'b':
    case 'strong':
      return 'bold';
    case 'i':
    case 'em':
      return 'italic';
    case 'u':
      return 'underline';
    case 's':
    case 'strike':
    case 'del':
      return 'strike';
    case 'code':
      return 'code';
    default:
      return null;
  }
}

export { makeSpan as span };
