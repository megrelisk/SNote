import type { Drive } from '@snote/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, IconButton, PromptModal, SyncPill } from '@/components/ui';
import { useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useService } from '@/lib/session';
import { useColors } from '@/lib/theme';

type Prompt =
  | { kind: 'new-drive' }
  | { kind: 'rename-drive'; drive: Drive }
  | { kind: 'new-folder'; driveId: string }
  | { kind: 'rename-folder'; folderId: string; name: string };

const DRIVE_ICONS = ['🗂', '🏠', '💼', '🎓', '💡', '📚', '🧪', '✈️', '❤️', '🎵'];

export default function DrivesScreen() {
  const colors = useColors();
  const service = useService();
  const drives = useDrives();
  const folders = useFolders();
  const notes = useNotes();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const driveMenu = (drive: Drive) =>
    Alert.alert(`${drive.icon ?? ''} ${drive.name}`, undefined, [
      { text: 'New folder', onPress: () => setPrompt({ kind: 'new-folder', driveId: drive.id }) },
      { text: 'Rename', onPress: () => setPrompt({ kind: 'rename-drive', drive }) },
      {
        text: 'Delete drive',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete drive?', `“${drive.name}” and all its folders and notes will be deleted on every device.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => void service.deleteDrive(drive.id) },
          ]),
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.statusRow}>
          <SyncPill />
          <Text style={{ color: colors.textFaint, fontSize: 12 }}>{notes.length} notes</Text>
        </View>

        {drives.map((drive) => {
          const open = !collapsed[drive.id];
          const driveFolders = folders.filter((f) => f.driveId === drive.id);
          return (
            <View key={drive.id} style={[styles.drive, { borderColor: colors.border }]}>
              <Pressable
                style={styles.driveHeader}
                onPress={() => setCollapsed((c) => ({ ...c, [drive.id]: open }))}
                onLongPress={() => driveMenu(drive)}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 22 }}>{drive.icon ?? '🗂'}</Text>
                <Text style={[styles.driveName, { color: colors.text }]} numberOfLines={1}>
                  {drive.name}
                </Text>
                <Text style={{ color: colors.textFaint }}>{notes.filter((n) => n.driveId === drive.id).length}</Text>
                <IconButton name="ellipsis-horizontal" label="Drive options" size={18} onPress={() => driveMenu(drive)} />
                <Icon name={open ? 'chevron-down' : 'chevron-forward'} size={16} />
              </Pressable>
              {open && (
                <View>
                  {driveFolders.map((folder) => (
                    <Pressable
                      key={folder.id}
                      onPress={() => router.push(`/folder/${folder.id}`)}
                      onLongPress={() =>
                        Alert.alert(folder.name, undefined, [
                          { text: 'Rename', onPress: () => setPrompt({ kind: 'rename-folder', folderId: folder.id, name: folder.name }) },
                          { text: 'Delete folder', style: 'destructive', onPress: () => void service.deleteFolder(folder.id) },
                          { text: 'Cancel', style: 'cancel' },
                        ])
                      }
                      style={({ pressed }) => [styles.folder, { borderTopColor: colors.border }, pressed && { backgroundColor: colors.hover }]}
                    >
                      <Icon name="folder-outline" size={18} />
                      <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{folder.name}</Text>
                      <Text style={{ color: colors.textFaint }}>{notes.filter((n) => n.folderId === folder.id).length || ''}</Text>
                      <Icon name="chevron-forward" size={16} color={colors.textFaint} />
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setPrompt({ kind: 'new-folder', driveId: drive.id })} style={[styles.folder, { borderTopColor: colors.border }]}>
                    <Icon name="add" size={18} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 15 }}>Add folder</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <Pressable onPress={() => setPrompt({ kind: 'new-drive' })} style={[styles.newDrive, { borderColor: colors.border }]}>
          <Icon name="add-circle-outline" color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>New drive</Text>
        </Pressable>
      </ScrollView>

      <PromptModal
        visible={!!prompt}
        title={
          prompt?.kind === 'new-drive'
            ? 'New drive'
            : prompt?.kind === 'new-folder'
              ? 'New folder'
              : 'Rename'
        }
        initialValue={prompt?.kind === 'rename-drive' ? prompt.drive.name : prompt?.kind === 'rename-folder' ? prompt.name : ''}
        placeholder="Name"
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (prompt?.kind === 'new-drive') service.createDrive(name, DRIVE_ICONS[drives.length % DRIVE_ICONS.length]);
          if (prompt?.kind === 'rename-drive') service.updateDrive(prompt.drive.id, { name });
          if (prompt?.kind === 'new-folder') service.createFolder(prompt.driveId, name);
          if (prompt?.kind === 'rename-folder') service.updateFolder(prompt.folderId, { name });
          setPrompt(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  drive: { marginHorizontal: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  driveHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  driveName: { flex: 1, fontSize: 17, fontWeight: '700' },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth },
  newDrive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
});
