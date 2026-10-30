import type { Block, BlockType, Mark } from '@snote/core';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { useColors } from '@/lib/theme';
import { IconButton, type IconName } from '../ui';
import type { MediaSource } from './context';

/**
 * Quick actions docked right above the soft keyboard: inline marks, block
 * types, media and tables.
 */
export function KeyboardToolbar({
  block,
  activeMarks,
  onMark,
  onType,
  onInsert,
  onAttach,
  onMore,
}: {
  block: Block;
  activeMarks: Mark[];
  onMark: (mark: Mark) => void;
  onType: (type: BlockType) => void;
  onInsert: (type: BlockType) => void;
  onAttach: (source: MediaSource) => void;
  onMore: () => void;
}) {
  const colors = useColors();
  const textual = 'text' in block.data;
  const items: { icon: IconName; label: string; onPress: () => void; active?: boolean; show?: boolean }[] = [
    { icon: 'add-circle-outline', label: 'Insert block', onPress: onMore },
    { icon: 'text', label: 'Bold', onPress: () => onMark('bold'), active: activeMarks.includes('bold'), show: textual },
    { icon: 'remove-outline', label: 'Strikethrough', onPress: () => onMark('strike'), active: activeMarks.includes('strike'), show: textual },
    { icon: 'code-slash-outline', label: 'Inline code', onPress: () => onMark('code'), active: activeMarks.includes('code'), show: textual },
    { icon: 'checkbox-outline', label: 'To-do', onPress: () => onType(block.type === 'todo' ? 'paragraph' : 'todo'), active: block.type === 'todo' },
    { icon: 'list-outline', label: 'Bulleted list', onPress: () => onType(block.type === 'bulleted' ? 'paragraph' : 'bulleted'), active: block.type === 'bulleted' },
    { icon: 'reorder-four-outline', label: 'Heading', onPress: () => onType(nextHeading(block.type)), active: block.type.startsWith('heading') },
    { icon: 'image-outline', label: 'Image from gallery', onPress: () => onAttach('library') },
    { icon: 'camera-outline', label: 'Take photo', onPress: () => onAttach('camera') },
    { icon: 'grid-outline', label: 'Table', onPress: () => onInsert('table') },
    { icon: 'attach-outline', label: 'Attach file', onPress: () => onAttach('file') },
  ];
  return (
    <View style={[styles.bar, { backgroundColor: colors.bgSoft, borderTopColor: colors.border }]}>
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
        {items
          .filter((i) => i.show !== false)
          .map((i) => (
            <IconButton key={i.label} name={i.icon} label={i.label} onPress={i.onPress} active={i.active} />
          ))}
      </ScrollView>
      <IconButton name="chevron-down" label="Hide keyboard" onPress={() => Keyboard.dismiss()} />
    </View>
  );
}

function nextHeading(type: BlockType): BlockType {
  if (type === 'heading1') return 'heading2';
  if (type === 'heading2') return 'heading3';
  if (type === 'heading3') return 'paragraph';
  return 'heading1';
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 4, height: 46 },
  items: { alignItems: 'center', gap: 2, paddingRight: 8 },
});
