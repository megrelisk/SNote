import { noteDisplayTitle, relativeTime, type Drive, type Folder, type Note } from '@snote/core';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/theme';
import { Icon } from './ui';

export function NoteRow({ note, drive, folder, showPath }: { note: Note; drive?: Drive; folder?: Folder; showPath?: boolean }) {
  const colors = useColors();
  const { service } = useSession();
  return (
    <Pressable
      onPress={() => router.push(`/note/${note.id}`)}
      onLongPress={() =>
        Alert.alert(noteDisplayTitle(note), undefined, [
          { text: note.pinned ? 'Unpin from widgets' : 'Pin to widgets', onPress: () => service?.updateNote(note.id, { pinned: !note.pinned }) },
          { text: 'Delete', style: 'destructive', onPress: () => void service?.deleteNote(note.id) },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.hover }]}
    >
      <View style={styles.top}>
        {note.pinned && <Icon name="pin" size={13} color={colors.accent} />}
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {noteDisplayTitle(note)}
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>{relativeTime(note.updatedAt)}</Text>
      </View>
      <Text numberOfLines={2} style={{ color: colors.textSoft, fontSize: 14, lineHeight: 19 }}>
        {note.preview || 'Empty note'}
      </Text>
      {showPath && (
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>
          {drive?.icon} {drive?.name} / {folder?.name}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, paddingVertical: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
});
