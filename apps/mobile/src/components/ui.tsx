import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  return <Ionicons name={name} size={size} color={color ?? colors.textSoft} style={style} />;
}

export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 22,
  active,
  style,
  ...rest
}: { name: IconName; label: string; color?: string; size?: number; active?: boolean; style?: StyleProp<ViewStyle> } & Omit<PressableProps, 'style'>) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && { backgroundColor: colors.accentSoft },
        pressed && { backgroundColor: colors.hover },
        style,
      ]}
      {...rest}
    >
      <Ionicons name={name} size={size} color={color ?? (active ? colors.accent : colors.textSoft)} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, { backgroundColor: selected ? colors.accent : colors.hover }]}
    >
      {icon && <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.textSoft} />}
      <Text numberOfLines={1} style={{ color: selected ? '#fff' : colors.text, fontSize: 14, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textFaint} />
      <Text style={{ color: colors.textSoft, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{title}</Text>
      {children}
    </View>
  );
}

export function SyncPill() {
  const { status } = useSession();
  const colors = useColors();
  const [icon, color, label]: [IconName, string, string] = !status.online
    ? ['cloud-offline-outline', colors.textSoft, 'Offline · saved on device']
    : status.pendingWrites
      ? ['sync-outline', colors.warn, 'Syncing…']
      : ['cloud-done-outline', colors.success, 'Synced'];
  return (
    <View style={styles.pill} accessibilityLabel={label}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function PromptModal({
  visible,
  title,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            onSubmitEditing={() => value.trim() && onSubmit(value.trim())}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.dialogActions}>
            <Pressable onPress={onCancel} style={styles.dialogButton}>
              <Text style={{ color: colors.textSoft, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => value.trim() && onSubmit(value.trim())} style={styles.dialogButton}>
              <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Fab({ onPress, label, icon = 'add' }: { onPress: () => void; label: string; icon?: IconName }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={28} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, maxWidth: 220 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32, flex: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  dialog: { borderRadius: 14, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  dialogButton: { paddingHorizontal: 12, paddingVertical: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
