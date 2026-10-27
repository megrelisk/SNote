import { describe, expect, it } from 'vitest';
import { richText } from '../src';

const { applyTextEdit, concat, marksAt, normalize, plainText, rangeHasMark, splitAt, toHtml, toggleMark } = richText;

describe('rich text', () => {
  it('normalizes adjacent spans with identical marks', () => {
    expect(
      normalize([
        { text: 'a', marks: ['bold'] },
        { text: 'b', marks: ['bold'] },
        { text: '' },
        { text: 'c' },
      ]),
    ).toEqual([{ text: 'ab', marks: ['bold'] }, { text: 'c' }]);
  });

  it('toggles a mark over a selection', () => {
    const bolded = toggleMark([{ text: 'hello world' }], 0, 5, 'bold');
    expect(bolded).toEqual([{ text: 'hello', marks: ['bold'] }, { text: ' world' }]);
    expect(rangeHasMark(bolded, 0, 5, 'bold')).toBe(true);
    expect(toggleMark(bolded, 0, 5, 'bold')).toEqual([{ text: 'hello world' }]);
  });

  it('adds a mark to a partially marked range instead of removing it', () => {
    const value = toggleMark([{ text: 'abcdef' }], 0, 3, 'italic');
    expect(toggleMark(value, 0, 6, 'italic')).toEqual([{ text: 'abcdef', marks: ['italic'] }]);
  });

  it('applies plain text edits while preserving formatting', () => {
    const value = [{ text: 'Hello ' }, { text: 'bold', marks: ['bold' as const] }, { text: ' end' }];
    // Typing inside the bold run inherits bold.
    expect(applyTextEdit(value, 'Hello boXld end')).toEqual([
      { text: 'Hello ' },
      { text: 'boXld', marks: ['bold'] },
      { text: ' end' },
    ]);
    // Deleting across a boundary keeps the remaining formatting.
    expect(applyTextEdit(value, 'Hello d end')).toEqual([
      { text: 'Hello ' },
      { text: 'd', marks: ['bold'] },
      { text: ' end' },
    ]);
    // Pending marks override inherited ones.
    expect(applyTextEdit([{ text: 'ab' }], 'abc', ['code'])).toEqual([
      { text: 'ab' },
      { text: 'c', marks: ['code'] },
    ]);
  });

  it('splits and concatenates', () => {
    const value = [{ text: 'one ' }, { text: 'two', marks: ['underline' as const] }];
    const [left, right] = splitAt(value, 5);
    expect(plainText(left)).toBe('one t');
    expect(right).toEqual([{ text: 'wo', marks: ['underline'] }]);
    expect(concat(left, right)).toEqual(value);
  });

  it('reports marks at the caret', () => {
    const value = [{ text: 'ab', marks: ['bold' as const] }, { text: 'cd' }];
    expect(marksAt(value, 0)).toEqual(['bold']);
    expect(marksAt(value, 2)).toEqual(['bold']);
    expect(marksAt(value, 3)).toEqual([]);
  });

  it('serialises to escaped HTML', () => {
    expect(toHtml([{ text: '<x>', marks: ['bold', 'italic'] }, { text: 'link', href: 'javascript:alert(1)' }])).toBe(
      '<em><strong>&lt;x&gt;</strong></em>link',
    );
  });
});
