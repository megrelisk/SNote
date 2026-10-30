import { BLOCK_LABELS, type BlockType } from '@snote/core';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/theme';
import { Icon, type IconName } from '../ui';

const ITEMS: { type: BlockType; icon: IconName; hint: string }[] = [
  { type: 'paragraph', icon: 'text-outline', hint: 'Plain text' },
  { type: 'heading1', icon: 'reorder-four-outline', hint: '#' },
  { type: 'heading2', icon: 'reorder-three-outline', hint: '##' },
  { type: 'heading3', icon: 'reorder-two-outline', hint: '###' },
  { type: 'bulleted', icon: 'list-outline', hint: '-' },
  { type: 'numbered', icon: 'list-circle-outline', hint: '1.' },
  { type: 'todo', icon: 'checkbox-outline', hint: '[]' },
  { type: 'code', icon: 'code-slash-outline', hint: '```' },
  { type: 'image', icon: 'image-outline', hint: 'Gallery / camera' },
  { type: 'file', icon: 'attach-outline', hint: 'PDF, DOC, ZIP…' },
  { type: 'table', icon: 'grid-outline', hint: 'Rows × columns' },
];

/** Bottom sheet for picking a block type ("/" command or the + button). */
export function TypeMenu({
  visible,
  title,
  onPick,
  onClose,
  extra,
}: {
  visible: boolean;
  title: string;
  onPick: (type: BlockType) => void;
  onClose: () => void;
  extra?: { label: string; icon: IconName; danger?: boolean; onPress: () => void }[];
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 }}>{title.toUpperCase()}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {extra?.map((x) => (
            <Pressable key={x.label} onPress={x.onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.hover }]}>
              <Icon name={x.icon} color={x.danger ? colors.danger : colors.text} />
              <Text style={{ color: x.danger ? colors.danger : colors.text, fontSize: 16, flex: 1 }}>{x.label}</Text>
            </Pressable>
          ))}
          {ITEMS.map((item) => (
            <Pressable key={item.type} onPress={() => onPick(item.type)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.hover }]}>
              <Icon name={item.icon} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{BLOCK_LABELS[item.type]}</Text>
              <Text style={{ color: colors.textFaint, fontSize: 13 }}>{item.hint}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 8 },
});
