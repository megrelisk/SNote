import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, View } from 'react-native';
import { NoteRow } from '@/components/NoteRow';
import { EmptyState, Fab } from '@/components/ui';
import { useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useService } from '@/lib/session';
import { useColors } from '@/lib/theme';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const service = useService();
  const folder = useFolders().find((f) => f.id === id);
  const drive = useDrives().find((d) => d.id === folder?.driveId);
  const notes = useNotes().filter((n) => n.folderId === id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: folder ? `${drive?.icon ?? ''} ${folder.name}` : '' }} />
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NoteRow note={item} />}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No notes in this folder yet" />}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      />
      {folder && (
        <Fab
          label="New note"
          onPress={() => {
            const { note } = service.createNote({ driveId: folder.driveId, folderId: folder.id });
            router.push(`/note/${note.id}`);
          }}
        />
      )}
    </View>
  );
}
