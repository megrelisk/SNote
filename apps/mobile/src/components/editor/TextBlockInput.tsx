import { richText, type BlockType, type Mark, type RichText, type Span, type TextLikeBlock } from '@snote/core';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useDebounced } from '@/lib/hooks';
import { useColors, type Colors } from '@/lib/theme';
import { Icon } from '../ui';
import { useEditor } from './context';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const SHORTCUTS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^#\s/, type: 'heading1' },
  { pattern: /^##\s/, type: 'heading2' },
  { pattern: /^###\s/, type: 'heading3' },
  { pattern: /^[-*•]\s/, type: 'bulleted' },
  { pattern: /^1[.)]\s/, type: 'numbered' },
  { pattern: /^\[\s?\]\s/, type: 'todo' },
  { pattern: /^```$/, type: 'code' },
];

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  paragraph: "Type '/' for blocks",
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bulleted: 'List item',
  numbered: 'List item',
  todo: 'To-do',
};

export function spanStyle(span: Span, colors: Colors): TextStyle {
  const marks = span.marks ?? [];
  const decoration = [marks.includes('underline') && 'underline', marks.includes('strike') && 'line-through'].filter(Boolean).join(' ');
  return {
    fontWeight: marks.includes('bold') ? '700' : undefined,
    fontStyle: marks.includes('italic') ? 'italic' : undefined,
    textDecorationLine: (decoration || undefined) as TextStyle['textDecorationLine'],
    fontFamily: marks.includes('code') ? MONO : undefined,
    color: marks.includes('code') ? colors.codeText : span.href ? colors.accent : undefined,
    backgroundColor: marks.includes('code') ? colors.codeBg : undefined,
  };
}

/** Renders rich text read-only (date filter results, previews). */
export function RichTextView({ value, style }: { value: RichText; style?: TextStyle }) {
  const colors = useColors();
  return (
    <Text style={[{ color: colors.text, fontSize: 16, lineHeight: 23 }, style]}>
      {value.map((s, i) => (
        <Text key={i} style={spanStyle(s, colors)}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

export function TextBlockInput({ block }: { block: TextLikeBlock }) {
  const editor = useEditor();
  const colors = useColors();
  const [value, setValue] = useState<RichText>(block.data.text);
  const valueRef = useRef(value);
  const selection = useRef({ start: 0, end: 0 });
  const pendingMarks = useRef<Mark[] | null>(null);
  const focused = useRef(false);
  const latest = useRef(block);
  latest.current = block;

  const apply = (next: RichText) => {
    valueRef.current = next;
    setValue(next);
  };

  const saver = useDebounced((text: RichText) => {
    const b = latest.current;
    editor.save({ ...b, data: { ...b.data, text } } as TextLikeBlock);
  }, 450);

  // Show remote changes unless the user is typing in this block.
  useEffect(() => {
    if (!focused.current) apply(block.data.text);
  }, [block.data.text]);

  useEffect(() => {
    editor.registerController(block.id, {
      toggleMark: (mark) => {
        const { start, end } = selection.current;
        if (start === end) {
          const base = pendingMarks.current ?? richText.marksAt(valueRef.current, start);
          pendingMarks.current = base.includes(mark) ? base.filter((m) => m !== mark) : [...base, mark];
          return;
        }
        const next = richText.toggleMark(valueRef.current, start, end, mark);
        apply(next);
        saver.call(next);
      },
      activeMarks: () => pendingMarks.current ?? richText.marksAt(valueRef.current, selection.current.start),
      currentText: () => valueRef.current,
      discardPending: () => saver.cancel(),
      setText: apply,
    });
    return () => editor.registerController(block.id, null);
  });

  useEffect(() => () => saver.flush(), [saver]);

  const onChangeText = (text: string) => {
    const next = richText.applyTextEdit(valueRef.current, text, pendingMarks.current ?? undefined);
    const plain = richText.plainText(next);
    if (block.type === 'paragraph') {
      if (plain === '/') {
        apply([]);
        saver.cancel();
        editor.openTypeMenu(block.id, 'convert');
        return;
      }
      for (const { pattern, type } of SHORTCUTS) {
        const m = pattern.exec(plain);
        if (m) {
          const rest = richText.slice(next, m[0].length);
          apply(rest);
          editor.convert(block, type, rest);
          return;
        }
      }
    }
    apply(next);
    saver.call(next);
  };

  const onSubmit = () => {
    saver.flush();
    const { start, end } = selection.current;
    const current = richText.concat(richText.slice(valueRef.current, 0, start), richText.slice(valueRef.current, end));
    const isList = block.type === 'bulleted' || block.type === 'numbered' || block.type === 'todo';
    if (isList && richText.plainText(current) === '') {
      editor.convert(block, 'paragraph', []);
      return;
    }
    const [left, right] = richText.splitAt(current, start);
    apply(left);
    editor.split({ ...block, data: { ...block.data, text: left } } as TextLikeBlock, left, right);
  };

  const checked = block.type === 'todo' && block.data.checked;
  const typeStyle = TYPE_STYLES[block.type];

  return (
    <View style={styles.row}>
      {block.type === 'bulleted' && <Text style={[styles.marker, { color: colors.text }]}>•</Text>}
      {block.type === 'numbered' && <Text style={[styles.marker, styles.number, { color: colors.text }]}>{editor.numberFor(block)}.</Text>}
      {block.type === 'todo' && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          hitSlop={10}
          style={styles.check}
          onPress={() => {
            saver.flush();
            editor.save({ ...block, data: { ...block.data, text: valueRef.current, checked: !block.data.checked } });
          }}
        >
          <Icon name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent : colors.textSoft} />
        </Pressable>
      )}
      <TextInput
        ref={(input) => editor.registerInput(block.id, input)}
        multiline
        submitBehavior="submit"
        scrollEnabled={false}
        placeholder={PLACEHOLDER[block.type]}
        placeholderTextColor={colors.textFaint}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onSelectionChange={(e) => {
          const next = e.nativeEvent.selection;
          if (next.start !== selection.current.start || next.end !== selection.current.end) pendingMarks.current = null;
          selection.current = next;
        }}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace' && selection.current.start === 0 && selection.current.end === 0) {
            saver.flush();
            editor.mergeBackward(block, valueRef.current);
          }
        }}
        onFocus={() => {
          focused.current = true;
          editor.setFocused(block.id);
        }}
        onBlur={() => {
          focused.current = false;
          pendingMarks.current = null;
          saver.flush();
        }}
        style={[
          styles.input,
          { color: checked ? colors.textFaint : colors.text },
          typeStyle,
          checked && { textDecorationLine: 'line-through' },
        ]}
      >
        {value.map((s, i) => (
          <Text key={i} style={spanStyle(s, colors)}>
            {s.text}
          </Text>
        ))}
      </TextInput>
    </View>
  );
}

const TYPE_STYLES: Partial<Record<BlockType, TextStyle>> = {
  heading1: { fontSize: 28, lineHeight: 34, fontWeight: '700', marginTop: 12 },
  heading2: { fontSize: 23, lineHeight: 29, fontWeight: '700', marginTop: 8 },
  heading3: { fontSize: 19, lineHeight: 25, fontWeight: '600', marginTop: 6 },
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  marker: { width: 22, fontSize: 17, lineHeight: 24, paddingTop: 4, textAlign: 'center' },
  number: { width: 26, fontSize: 16, textAlign: 'right', paddingRight: 4 },
  check: { paddingTop: 5, paddingRight: 6 },
  input: { flex: 1, fontSize: 16, lineHeight: 23, paddingVertical: 4, paddingHorizontal: 0, textAlignVertical: 'top' },
});
