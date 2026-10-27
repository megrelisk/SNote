import { formatTimestamp, isTextLike, type Block } from '@snote/core';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/lib/theme';
import { Icon } from '../ui';
import { useEditor } from './context';
import { CodeBlockInput, FileBlockView, ImageBlockView, TableBlockView } from './OtherBlocks';
import { TextBlockInput } from './TextBlockInput';

/**
 * One block row. Timestamps stay hidden; tapping (focusing) or selecting the
 * block reveals its exact created / edited time down to the second.
 * Long-press the handle to drag the block to a new position.
 */
export const BlockItem = memo(function BlockItem({ block, drag, isActive }: { block: Block; drag: () => void; isActive: boolean }) {
  const editor = useEditor();
  const colors = useColors();
  const revealed = editor.focusedId === block.id || editor.selectedId === block.id;
  const edited = block.updatedAt !== block.createdAt;

  const body = (() => {
    if (isTextLike(block)) return <TextBlockInput block={block} />;
    switch (block.type) {
      case 'code':
        return <CodeBlockInput block={block} />;
      case 'image':
        return <ImageBlockView block={block} />;
      case 'file':
        return <FileBlockView block={block} />;
      case 'table':
        return <TableBlockView block={block} />;
    }
  })();

  return (
    <View
      style={[
        styles.row,
        revealed && { backgroundColor: colors.accentSoft },
        isActive && { backgroundColor: colors.card, shadowOpacity: 0.2, elevation: 6 },
      ]}
    >
      <Pressable
        onLongPress={drag}
        delayLongPress={180}
        onPress={() => editor.select(editor.selectedId === block.id ? null : block.id)}
        hitSlop={6}
        style={styles.handle}
        accessibilityLabel="Block handle: tap to show timestamps, long-press to move"
      >
        <Icon name="reorder-two-outline" size={16} color={colors.textFaint} />
      </Pressable>
      <View style={styles.body}>
        {body}
        {revealed && (
          <View style={styles.meta} accessibilityLabel="Block timestamps">
            <Text style={[styles.metaText, { color: colors.textSoft }]}>
              <Text style={{ color: colors.textFaint }}>Created </Text>
              {formatTimestamp(block.createdAt)}
            </Text>
            {edited && (
              <Text style={[styles.metaText, { color: colors.textSoft }]}>
                <Text style={{ color: colors.textFaint }}>Edited </Text>
                {formatTimestamp(block.updatedAt)}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 8, paddingRight: 8, shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0 },
  handle: { width: 28, paddingTop: 9, alignItems: 'center' },
  body: { flex: 1, paddingVertical: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, paddingBottom: 6 },
  metaText: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
});
