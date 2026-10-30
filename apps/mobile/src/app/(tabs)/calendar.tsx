import {
  dayKey,
  filterByDate,
  formatTimestamp,
  noteDisplayTitle,
  type Block,
  type DateFilterField,
  type DateFilterScope,
  type DayKey,
} from '@snote/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar } from '@/components/Calendar';
import { RichTextView } from '@/components/editor/TextBlockInput';
import { Chip, EmptyState, Icon } from '@/components/ui';
import { useBlocksOnDay, useDrives, useFolders, useNotes } from '@/lib/hooks';
import { useColors } from '@/lib/theme';

/** Smart date filter: every block created or edited on the chosen day, by Drive → Folder → Note. */
export default function CalendarScreen() {
  const colors = useColors();
  const drives = useDrives();
  const folders = useFolders();
  const notes = useNotes();
  const [day, setDay] = useState<DayKey>(dayKey(Date.now()));
  const [field, setField] = useState<DateFilterField>('any');
  const [scope, setScope] = useState<DateFilterScope>({});
  const { items: blocks, loading } = useBlocksOnDay(day);

  const activeDays = useMemo(() => {
    const days = new Set<DayKey>();
    for (const n of notes) {
      days.add(dayKey(n.createdAt));
      days.add(dayKey(n.updatedAt));
    }
    return days;
  }, [notes]);

  const result = useMemo(() => filterByDate({ drives, folders, notes, blocks }, day, { field, scope }), [drives, folders, notes, blocks, day, field, scope]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}>
      <Calendar value={day} onChange={setDay} activeDays={activeDays} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Created or edited" selected={field === 'any'} onPress={() => setField('any')} />
        <Chip label="Created" selected={field === 'created'} onPress={() => setField('created')} />
        <Chip label="Edited" selected={field === 'updated'} onPress={() => setField('updated')} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip icon="globe-outline" label="All drives" selected={!scope.driveId} onPress={() => setScope({})} />
        {drives.map((d) => (
          <Chip key={d.id} label={`${d.icon ?? ''} ${d.name}`} selected={scope.driveId === d.id && !scope.folderId} onPress={() => setScope({ driveId: d.id })} />
        ))}
        {scope.driveId &&
          folders
            .filter((f) => f.driveId === scope.driveId)
            .map((f) => (
              <Chip key={f.id} icon="folder-outline" label={f.name} selected={scope.folderId === f.id} onPress={() => setScope({ driveId: f.driveId, folderId: f.id })} />
            ))}
      </ScrollView>

      <Text style={{ color: colors.textSoft }}>
        {result.blockCount} block{result.blockCount === 1 ? '' : 's'} in {result.noteCount} note{result.noteCount === 1 ? '' : 's'}
      </Text>

      {!loading && result.drives.length === 0 && <EmptyState icon="calendar-clear-outline" title="Nothing was created or edited on this day." />}

      {result.drives.map(({ drive, folders: fgroups }) => (
        <View key={drive.id} style={{ gap: 8 }}>
          <Text style={[styles.drive, { color: colors.text }]}>
            {drive.icon} {drive.name}
          </Text>
          {fgroups.map(({ folder, notes: ngroups }) => (
            <View key={folder.id} style={{ gap: 8 }}>
              <View style={styles.folderRow}>
                <Icon name="folder-outline" size={15} />
                <Text style={{ color: colors.textSoft, fontWeight: '600' }}>{folder.name}</Text>
              </View>
              {ngroups.map(({ note, blocks: nb, noteTouched }) => (
                <View key={note.id} style={[styles.noteCard, { borderColor: colors.border }]}>
                  <Pressable onPress={() => router.push(`/note/${note.id}`)} style={styles.noteTitle}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{noteDisplayTitle(note)}</Text>
                    <Icon name="chevron-forward" size={16} />
                  </Pressable>
                  {nb.length === 0 && noteTouched && <Text style={{ color: colors.textFaint }}>Note created or renamed on this day.</Text>}
                  {nb.map((b) => (
                    <Pressable key={b.id} onPress={() => router.push(`/note/${note.id}`)} style={styles.block}>
                      <BlockPreview block={b} />
                      <View style={styles.stamps}>
                        <Text style={[styles.stamp, { color: dayKey(b.createdAt) === day ? colors.accent : colors.textFaint }]}>
                          Created {formatTimestamp(b.createdAt)}
                        </Text>
                        {b.updatedAt !== b.createdAt && (
                          <Text style={[styles.stamp, { color: dayKey(b.updatedAt) === day ? colors.accent : colors.textFaint }]}>
                            Edited {formatTimestamp(b.updatedAt)}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function BlockPreview({ block }: { block: Block }) {
  const colors = useColors();
  switch (block.type) {
    case 'code':
      return (
        <Text style={{ color: colors.text, fontFamily: 'monospace', backgroundColor: colors.codeBg, padding: 6, borderRadius: 6 }}>{block.data.code}</Text>
      );
    case 'image':
      return <Text style={{ color: colors.textSoft }}>🖼 {block.data.caption || block.data.image?.name || 'Image'}</Text>;
    case 'file':
      return <Text style={{ color: colors.textSoft }}>📎 {block.data.file?.name ?? 'File'}</Text>;
    case 'table':
      return <Text style={{ color: colors.textSoft }}>▦ Table · {block.data.rows.length} rows</Text>;
    case 'todo':
      return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Icon name={block.data.checked ? 'checkbox' : 'square-outline'} size={18} color={block.data.checked ? colors.accent : colors.textSoft} />
          <RichTextView value={block.data.text} style={block.data.checked ? { textDecorationLine: 'line-through', color: colors.textFaint } : undefined} />
        </View>
      );
    default:
      return <RichTextView value={block.data.text} style={block.type.startsWith('heading') ? { fontWeight: '700' } : undefined} />;
  }
}

const styles = StyleSheet.create({
  chips: { gap: 8 },
  drive: { fontSize: 19, fontWeight: '700', marginTop: 6 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 8 },
  noteTitle: { flexDirection: 'row', alignItems: 'center' },
  block: { gap: 3 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  stamp: { fontSize: 11.5, fontVariant: ['tabular-nums'] },
});
