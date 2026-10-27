import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { NoteRow } from '@/components/NoteRow';
import { EmptyState, Icon } from '@/components/ui';
import { useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useColors } from '@/lib/theme';

export default function RecentScreen() {
  const colors = useColors();
  const notes = useNotes();
  const drives = useDrives();
  const folders = useFolders();
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.preview.toLowerCase().includes(q)) : notes;
  }, [notes, query]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.search, { backgroundColor: colors.hover }]}>
        <Icon name="search" size={16} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes"
          placeholderTextColor={colors.textFaint}
          style={{ flex: 1, color: colors.text, fontSize: 16, padding: 0 }}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NoteRow note={item} drive={drives.find((d) => d.id === item.driveId)} folder={folders.find((f) => f.id === item.folderId)} showPath />
        )}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title={query ? 'No matching notes' : 'No notes yet'} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
});
