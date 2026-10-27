import { richText, type Mark, type RichText, type Span } from '@snote/core';

/**
 * DOM ⇄ RichText bridging for the contentEditable text blocks, plus caret
 * helpers that address positions as plain-text character offsets (the same
 * coordinates the core rich-text operations use).
 */

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

export function domToRichText(root: HTMLElement): RichText {
  const spans: Span[] = [];
  const walk = (node: Node, marks: Mark[], href: string | undefined) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/ /g, ' ').replace(/​/g, '');
      if (text) spans.push({ text, marks: [...marks], href });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === 'BR') {
      // A trailing <br> is the browser's placeholder for an empty last line.
      if (node.nextSibling || node.parentElement !== root) spans.push({ text: '\n', marks: [...marks] });
      return;
    }
    const mark = richText.markForTag(node.tagName);
    let nextMarks = mark && !marks.includes(mark) ? [...marks, mark] : marks;
    const weight = node.style?.fontWeight;
    if ((weight === 'bold' || Number(weight) >= 600) && !nextMarks.includes('bold')) nextMarks = [...nextMarks, 'bold'];
    if (node.style?.fontStyle === 'italic' && !nextMarks.includes('italic')) nextMarks = [...nextMarks, 'italic'];
    const nextHref = node.tagName === 'A' ? node.getAttribute('href') ?? href : href;
    if (BLOCK_TAGS.has(node.tagName) && spans.length && !spans[spans.length - 1]!.text.endsWith('\n')) {
      spans.push({ text: '\n' });
    }
    node.childNodes.forEach((child) => walk(child, nextMarks, nextHref ?? undefined));
  };
  root.childNodes.forEach((child) => walk(child, [], undefined));
  return richText.normalize(spans.map((s) => ({ text: s.text, marks: s.marks?.length ? s.marks : undefined, href: s.href })));
}

export function richTextToHtml(value: RichText): string {
  const html = richText.toHtml(value);
  // Keep a trailing newline visible/caretable.
  return html.endsWith('<br>') ? `${html}<br>` : html;
}

/** Plain-text length of a node, counting <br> as one character. */
function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').length;
  if (node instanceof HTMLElement && node.tagName === 'BR') return 1;
  let n = 0;
  node.childNodes.forEach((c) => (n += nodeLength(c)));
  return n;
}

function offsetOf(root: HTMLElement, container: Node, offset: number): number {
  let total = 0;
  let found = false;
  const visit = (node: Node): void => {
    if (found) return;
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) total += offset;
      else for (let i = 0; i < offset && i < node.childNodes.length; i++) total += nodeLength(node.childNodes[i]!);
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && node.tagName === 'BR')) {
      total += nodeLength(node);
      return;
    }
    node.childNodes.forEach(visit);
  };
  visit(root);
  return total;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOf(root, range.startContainer, range.startOffset);
  const end = offsetOf(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function locate(root: HTMLElement, target: number): { node: Node; offset: number } {
  let remaining = target;
  let result: { node: Node; offset: number } | null = null;
  const visit = (node: Node): void => {
    if (result) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) result = { node, offset: remaining };
      else remaining -= len;
      return;
    }
    if (node instanceof HTMLElement && node.tagName === 'BR') {
      if (remaining === 0) {
        const parent = node.parentNode!;
        result = { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, node) };
      } else remaining -= 1;
      return;
    }
    node.childNodes.forEach(visit);
  };
  visit(root);
  return result ?? { node: root, offset: root.childNodes.length };
}

export function setSelectionOffsets(root: HTMLElement, start: number, end = start): void {
  const sel = window.getSelection();
  if (!sel) return;
  const a = locate(root, start);
  const b = end === start ? a : locate(root, end);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** True when the caret sits on the first visual line of the element. */
export function caretOnFirstLine(root: HTMLElement): boolean {
  const rect = caretRect();
  if (!rect) return true;
  const box = root.getBoundingClientRect();
  return rect.top - box.top < rect.height * 0.9 || rect.height === 0;
}

export function caretOnLastLine(root: HTMLElement): boolean {
  const rect = caretRect();
  if (!rect) return true;
  const box = root.getBoundingClientRect();
  return box.bottom - rect.bottom < rect.height * 0.9 || rect.height === 0;
}

function caretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rects = range.getClientRects();
  return rects[0] ?? null;
}
