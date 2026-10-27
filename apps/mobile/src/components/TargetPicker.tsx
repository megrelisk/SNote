import type { Drive, Folder } from '@snote/core';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/lib/theme';
import { Chip } from './ui';

/** Drive + Folder selector used by Quick Capture and "Move note". */
export function TargetPicker({
  drives,
  folders,
  value,
  onChange,
}: {
  drives: Drive[];
  folders: Folder[];
  value: { driveId: string; folderId: string } | null;
  onChange: (target: { driveId: string; folderId: string }) => void;
}) {
  const colors = useColors();
  const driveFolders = folders.filter((f) => f.driveId === value?.driveId);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.label, { color: colors.textFaint }]}>DRIVE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {drives.map((d) => (
          <Chip
            key={d.id}
            label={`${d.icon ?? '🗂'} ${d.name}`}
            selected={d.id === value?.driveId}
            onPress={() => {
              const first = folders.find((f) => f.driveId === d.id);
              if (first) onChange({ driveId: d.id, folderId: first.id });
            }}
          />
        ))}
      </ScrollView>
      <Text style={[styles.label, { color: colors.textFaint }]}>FOLDER</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {driveFolders.length === 0 && <Text style={{ color: colors.textSoft }}>This drive has no folders yet.</Text>}
        {driveFolders.map((f) => (
          <Chip key={f.id} icon="folder-outline" label={f.name} selected={f.id === value?.folderId} onPress={() => onChange({ driveId: f.driveId, folderId: f.id })} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  row: { gap: 8, paddingRight: 16 },
});
