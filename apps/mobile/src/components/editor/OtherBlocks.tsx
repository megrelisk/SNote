import { table, type BlockOf, type TableBlockData } from '@snote/core';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDebounced } from '@/lib/hooks';
import { useColors } from '@/lib/theme';
import { displayUri } from '@/lib/uploads';
import { Icon } from '../ui';
import { useEditor } from './context';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function CodeBlockInput({ block }: { block: BlockOf<'code'> }) {
  const editor = useEditor();
  const colors = useColors();
  const [code, setCode] = useState(block.data.code);
  const focused = useRef(false);
  const latest = useRef(block);
  latest.current = block;
  const saver = useDebounced((next: string) => editor.save({ ...latest.current, data: { ...latest.current.data, code: next } }), 450);
  useEffect(() => {
    if (!focused.current) setCode(block.data.code);
  }, [block.data.code]);
  useEffect(() => () => saver.flush(), [saver]);
  return (
    <View style={[styles.code, { backgroundColor: colors.codeBg }]}>
      <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 2 }}>{block.data.language ?? 'code'}</Text>
      <TextInput
        ref={(input) => editor.registerInput(block.id, input)}
        multiline
        scrollEnabled={false}
        autoCapitalize="none"
        autoCorrect={false}
        value={code}
        placeholder="// code"
        placeholderTextColor={colors.textFaint}
        onChangeText={(t) => {
          setCode(t);
          saver.call(t);
        }}
        onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace' && code === '') editor.mergeBackward(block, []);
        }}
        onFocus={() => {
          focused.current = true;
          editor.setFocused(block.id);
        }}
        onBlur={() => {
          focused.current = false;
          saver.flush();
        }}
        style={{ color: colors.text, fontFamily: MONO, fontSize: 14, lineHeight: 20, padding: 0, textAlignVertical: 'top' }}
      />
    </View>
  );
}

function AttachPrompt({ block, kind }: { block: BlockOf<'image'> | BlockOf<'file'>; kind: 'image' | 'file' }) {
  const editor = useEditor();
  const colors = useColors();
  const button = (icon: Parameters<typeof Icon>[0]['name'], label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={[styles.attachButton, { backgroundColor: colors.hover }]}>
      <Icon name={icon} size={18} color={colors.text} />
      <Text style={{ color: colors.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.attachRow}>
      {kind === 'image' ? (
        <>
          {button('images-outline', 'Gallery', () => editor.attach('library', block))}
          {button('camera-outline', 'Camera', () => editor.attach('camera', block))}
        </>
      ) : (
        button('attach-outline', 'Choose file', () => editor.attach('file', block))
      )}
    </View>
  );
}

export function ImageBlockView({ block }: { block: BlockOf<'image'> }) {
  const editor = useEditor();
  const colors = useColors();
  const [caption, setCaption] = useState(block.data.caption ?? '');
  useEffect(() => setCaption(block.data.caption ?? ''), [block.data.caption]);
  if (!block.data.image) return <AttachPrompt block={block} kind="image" />;
  const uri = displayUri(block.data.image);
  const ratio = block.data.width && block.data.height ? block.data.width / block.data.height : 4 / 3;
  return (
    <View style={{ gap: 4 }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { aspectRatio: ratio, backgroundColor: colors.hover }]} resizeMode="cover" accessibilityLabel={caption || block.data.image.name} />
      ) : (
        <View style={[styles.pending, { backgroundColor: colors.hover }]}>
          <Icon name="cloud-upload-outline" />
          <Text style={{ color: colors.textSoft }}>Waiting for upload to sync…</Text>
        </View>
      )}
      <TextInput
        value={caption}
        onChangeText={setCaption}
        onBlur={() => caption !== (block.data.caption ?? '') && editor.save({ ...block, data: { ...block.data, caption } })}
        placeholder="Add a caption"
        placeholderTextColor={colors.textFaint}
        style={{ color: colors.textSoft, fontSize: 13, padding: 0 }}
      />
    </View>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FileBlockView({ block }: { block: BlockOf<'file'> }) {
  const colors = useColors();
  const file = block.data.file;
  if (!file) return <AttachPrompt block={block} kind="file" />;
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toUpperCase().slice(0, 4) : 'FILE';
  const local = file.localUri && new File(file.localUri).exists ? file.localUri : null;

  const open = async () => {
    if (local) {
      try {
        await File.preview(new File(local));
        return;
      } catch {
        // Preview unsupported for this type/platform; fall back to the share sheet.
        if (await Sharing.isAvailableAsync()) return Sharing.shareAsync(local, { mimeType: file.mimeType });
      }
    }
    if (file.url) await Linking.openURL(file.url);
  };

  return (
    <Pressable onPress={open} style={[styles.fileCard, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Open ${file.name}`}>
      <View style={[styles.fileExt, { backgroundColor: colors.accentSoft }]}>
        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 11 }}>{ext}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>
          {file.name}
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: 12 }}>
          {formatSize(file.size)}
          {!file.url ? ' · pending upload' : ''}
        </Text>
      </View>
      <Icon name="eye-outline" />
      {local && (
        <Pressable hitSlop={8} onPress={() => void Sharing.shareAsync(local, { mimeType: file.mimeType })} accessibilityLabel="Share file">
          <Icon name="share-outline" />
        </Pressable>
      )}
    </Pressable>
  );
}

export function TableBlockView({ block }: { block: BlockOf<'table'> }) {
  const editor = useEditor();
  const colors = useColors();
  const [data, setData] = useState<TableBlockData>(block.data);
  const editing = useRef(false);
  const latest = useRef(block);
  latest.current = block;
  const saver = useDebounced((next: TableBlockData) => editor.save({ ...latest.current, data: next }), 450);
  useEffect(() => {
    if (!editing.current) setData(block.data);
  }, [block.data]);
  useEffect(() => () => saver.flush(), [saver]);
  const update = (next: TableBlockData, immediate = false) => {
    setData(next);
    if (immediate) {
      saver.cancel();
      editor.save({ ...latest.current, data: next });
    } else saver.call(next);
  };
  const cols = Math.max(1, ...data.rows.map((r) => r.length));

  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.tableRow}>
            {Array.from({ length: cols }, (_, c) => (
              <View key={c} style={styles.colTools}>
                <Pressable hitSlop={6} disabled={cols <= 1} onPress={() => update(table.removeColumn(data, c), true)} accessibilityLabel={`Delete column ${c + 1}`}>
                  <Icon name="close" size={14} color={colors.textFaint} />
                </Pressable>
              </View>
            ))}
          </View>
          {data.rows.map((row, r) => (
            <View key={r} style={styles.tableRow}>
              {Array.from({ length: cols }, (_, c) => (
                <TextInput
                  key={c}
                  multiline
                  value={row[c] ?? ''}
                  onFocus={() => {
                    editing.current = true;
                    editor.setFocused(block.id);
                  }}
                  onBlur={() => {
                    editing.current = false;
                    saver.flush();
                  }}
                  onChangeText={(t) => update(table.setCell(data, r, c, t))}
                  style={[
                    styles.cell,
                    { borderColor: colors.border, color: colors.text },
                    data.header && r === 0 && { backgroundColor: colors.bgSoft, fontWeight: '600' },
                  ]}
                />
              ))}
              <Pressable hitSlop={6} disabled={data.rows.length <= 1} onPress={() => update(table.removeRow(data, r), true)} style={styles.rowTool} accessibilityLabel={`Delete row ${r + 1}`}>
                <Icon name="close" size={14} color={colors.textFaint} />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.attachRow}>
        <Pressable onPress={() => update(table.addRow(data), true)} style={[styles.attachButton, { backgroundColor: colors.hover }]}>
          <Icon name="add" size={16} color={colors.text} />
          <Text style={{ color: colors.text }}>Row</Text>
        </Pressable>
        <Pressable onPress={() => update(table.addColumn(data), true)} style={[styles.attachButton, { backgroundColor: colors.hover }]}>
          <Icon name="add" size={16} color={colors.text} />
          <Text style={{ color: colors.text }}>Column</Text>
        </Pressable>
        <Pressable onPress={() => update(table.toggleHeader(data), true)} style={[styles.attachButton, { backgroundColor: data.header ? colors.accentSoft : colors.hover }]}>
          <Text style={{ color: data.header ? colors.accent : colors.text }}>Header</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  code: { borderRadius: 8, padding: 12, marginVertical: 4 },
  attachRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
  attachButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  image: { width: '100%', borderRadius: 8 },
  pending: { flexDirection: 'row', gap: 8, padding: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, padding: 10, marginVertical: 4 },
  fileExt: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'stretch' },
  colTools: { width: 120, alignItems: 'center', paddingBottom: 2 },
  cell: { width: 120, minHeight: 40, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, textAlignVertical: 'top' },
  rowTool: { justifyContent: 'center', paddingHorizontal: 6 },
});
