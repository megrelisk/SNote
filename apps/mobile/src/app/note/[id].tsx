import { blocksToMarkdown } from '@snote/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { NoteEditor } from '@/components/editor/NoteEditor';
import { TargetPicker } from '@/components/TargetPicker';
import { EmptyState, IconButton } from '@/components/ui';
import { useDrives, useFolders, useWatch } from '@/lib/hooks';
import { useService } from '@/lib/session';
import { useColors } from '@/lib/theme';

/** Opened from lists, the date filter, and widget cards (`snote://note/<id>`). */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const service = useService();
  const { items, loading } = useWatch('notes', [], 'all');
  const note = items.find((n) => n.id === id && !n.deleted);
  const drives = useDrives();
  const folders = useFolders();
  const [moving, setMoving] = useState(false);
  const drive = drives.find((d) => d.id === note?.driveId);
  const folder = folders.find((f) => f.id === note?.folderId);

  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} /> : <EmptyState icon="document-outline" title="This note was deleted or hasn't synced yet." />}
      </View>
    );
  }

  const more = () =>
    Alert.alert('Note', undefined, [
      { text: 'Move to…', onPress: () => setMoving(true) },
      {
        text: 'Share as text',
        onPress: async () => {
          const blocks = await service.once('blocks', [{ field: 'noteId', op: '==', value: note.id }]);
          await Share.share({ message: `${note.title}\n\n${blocksToMarkdown(blocks.sort((a, b) => a.order - b.order))}` });
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void service.deleteNote(note.id);
          router.back();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: `${drive?.icon ?? ''} ${folder?.name ?? ''}`,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                name={note.pinned ? 'pin' : 'pin-outline'}
                label={note.pinned ? 'Unpin from widgets' : 'Pin to widgets'}
                active={note.pinned}
                onPress={() => service.updateNote(note.id, { pinned: !note.pinned })}
              />
              <IconButton name="ellipsis-horizontal-circle-outline" label="More" onPress={more} />
            </View>
          ),
        }}
      />
      <NoteEditor key={note.id} note={note} />

      <Modal visible={moving} transparent animationType="slide" onRequestClose={() => setMoving(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMoving(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Move note</Text>
          <TargetPicker
            drives={drives}
            folders={folders}
            value={{ driveId: note.driveId, folderId: note.folderId }}
            onChange={(target) => {
              void service.moveNote(note, target);
              setMoving(false);
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { padding: 20, paddingBottom: 40, gap: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
});
