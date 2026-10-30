import {
  convertBlock,
  formatTimestamp,
  isTextLike,
  richText,
  type Block,
  type BlockDataMap,
  type BlockType,
  type Mark,
  type Note,
} from '@snote/core';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { useDebounced, useNoteBlocks } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/theme';
import { uploadAttachment, type PickedFile } from '@/lib/uploads';
import { Icon } from '../ui';
import { BlockItem } from './BlockItem';
import { EditorContext, type MediaSource, type MobileEditorApi, type TextController } from './context';
import { KeyboardToolbar } from './KeyboardToolbar';
import { TypeMenu } from './TypeMenu';

async function pickMedia(source: MediaSource): Promise<(PickedFile & { width?: number; height?: number }) | null> {
  if (source === 'file') {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 };
  }
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos for your notes.');
      return null;
    }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  };
}

export function NoteEditor({ note }: { note: Note }) {
  const { service, user } = useSession();
  const colors = useColors();
  const { items: blocks, loading } = useNoteBlocks(note.id);
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const inputs = useRef(new Map<string, TextInputInstance>());
  const controllers = useRef(new Map<string, TextController>());
  const pendingFocus = useRef<{ id: string; position: 'start' | 'end' | number } | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ blockId: string | null; mode: 'convert' | 'insert' } | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [title, setTitle] = useState(note.title);
  const titleFocused = useRef(false);

  useEffect(() => {
    if (!titleFocused.current) setTitle(note.title);
  }, [note.title]);
  const titleSaver = useDebounced((value: string) => service?.updateNote(note.id, { title: value }), 400);
  useEffect(() => () => titleSaver.flush(), [titleSaver]);

  const applyFocus = useCallback(() => {
    const request = pendingFocus.current;
    if (!request) return;
    const input = inputs.current.get(request.id);
    if (!input) return;
    pendingFocus.current = null;
    input.focus();
    const length = richText.plainText(controllers.current.get(request.id)?.currentText() ?? []).length;
    const pos = request.position === 'start' ? 0 : request.position === 'end' ? length : Math.min(request.position, length);
    // Wait a frame so the native view has the new text before moving the caret.
    requestAnimationFrame(() => input.setSelection?.(pos, pos));
  }, []);

  useEffect(applyFocus, [blocks, applyFocus]);

  const api = useMemo<MobileEditorApi | null>(() => {
    if (!service) return null;
    const siblings = () => blocksRef.current;
    const neighbour = (block: Block, delta: number) => {
      const list = siblings();
      const i = list.findIndex((b) => b.id === block.id);
      return i >= 0 ? list[i + delta] : undefined;
    };
    const focus = (id: string, position: 'start' | 'end' | number = 'end') => {
      pendingFocus.current = { id, position };
      setTimeout(applyFocus, 0);
    };
    const save = (block: Block) => {
      const saved = service.saveBlock(block, siblings());
      blocksRef.current = siblings().map((b) => (b.id === saved.id ? saved : b));
    };
    const insertAfter = <T extends BlockType>(block: Block | null, type: T, data?: BlockDataMap[T]): Block => {
      const created = service.insertBlock(note, siblings(), type, { afterId: block?.id, data }) as Block;
      blocksRef.current = [...siblings(), created];
      return created;
    };
    const api: MobileEditorApi = {
      note,
      blocks,
      service,
      focusedId,
      selectedId,
      save,
      split: (block, left, right) => {
        save({ ...block, data: { ...block.data, text: left } } as Block);
        const created =
          block.type === 'todo'
            ? insertAfter(block, 'todo', { text: right, checked: false })
            : block.type === 'bulleted' || block.type === 'numbered'
              ? insertAfter(block, block.type, { text: right })
              : insertAfter(block, 'paragraph', { text: right });
        focus(created.id, 'start');
      },
      mergeBackward: (block, current) => {
        if (block.type !== 'paragraph') {
          api.convert(block, 'paragraph', isTextLike(block) ? current : []);
          return;
        }
        const prev = neighbour(block, -1);
        if (!prev) return;
        if (isTextLike(prev)) {
          const joinAt = richText.plainText(prev.data.text).length;
          save({ ...prev, data: { ...prev.data, text: richText.concat(prev.data.text, current) } } as Block);
          service.deleteBlock(block, siblings());
          blocksRef.current = siblings().filter((b) => b.id !== block.id);
          focus(prev.id, joinAt);
        } else if (richText.plainText(current) === '') {
          service.deleteBlock(block, siblings());
          setSelectedId(prev.id);
        }
      },
      insertAfter,
      convert: (block, type, text) => {
        const controller = controllers.current.get(block.id);
        if (text === undefined && controller) text = controller.currentText();
        controller?.discardPending();
        let next = convertBlock(block, type);
        if (text !== undefined && isTextLike(next)) next = { ...next, data: { ...next.data, text } } as Block;
        save(next);
        if (isTextLike(next)) {
          controller?.setText(next.data.text);
          focus(block.id, 'start');
        }
      },
      remove: (block) => {
        const prev = neighbour(block, -1) ?? neighbour(block, 1);
        service.deleteBlock(block, siblings());
        blocksRef.current = siblings().filter((b) => b.id !== block.id);
        setSelectedId(null);
        if (prev) focus(prev.id, 'end');
      },
      focus,
      select: (id) => setSelectedId(id),
      setFocused: (id) => {
        setFocusedId(id);
        setSelectedId(null);
        setMarks(id ? (controllers.current.get(id)?.activeMarks() ?? []) : []);
      },
      registerInput: (id, input) => {
        if (input) inputs.current.set(id, input);
        else inputs.current.delete(id);
      },
      registerController: (id, controller) => {
        if (controller) controllers.current.set(id, controller);
        else controllers.current.delete(id);
      },
      openTypeMenu: (blockId, mode) => setMenu({ blockId, mode }),
      attach: (source, block) => {
        void (async () => {
          const picked = await pickMedia(source);
          if (!picked || !user) return;
          const type: 'image' | 'file' = source !== 'file' || picked.mimeType.startsWith('image/') ? 'image' : 'file';
          const reuse = block.type === type && !(type === 'image' ? (block as Block & { type: 'image' }).data.image : (block as Block & { type: 'file' }).data.file);
          const target = reuse ? block : insertAfter(block, type);
          try {
            const media = await uploadAttachment(picked, target.id, user.uid);
            const current = blocksRef.current.find((b) => b.id === target.id) ?? target;
            save(
              (type === 'image'
                ? { ...current, data: { image: media, width: picked.width, height: picked.height } }
                : { ...current, data: { file: media } }) as Block,
            );
          } catch (e) {
            Alert.alert('Could not attach', e instanceof Error ? e.message : String(e));
          }
        })();
      },
      numberFor: (block) => {
        const list = siblings();
        let n = 0;
        for (let i = list.findIndex((b) => b.id === block.id); i >= 0 && list[i]!.type === 'numbered'; i--) n++;
        return Math.max(1, n);
      },
    };
    return api;
  }, [service, note, blocks, focusedId, selectedId, user, applyFocus]);

  if (!api || !service) return null;

  const focusedBlock = blocks.find((b) => b.id === focusedId) ?? null;
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  const appendParagraph = () => {
    const last = blocks[blocks.length - 1];
    if (last && isTextLike(last) && richText.plainText(last.data.text) === '') api.focus(last.id, 'start');
    else api.focus(api.insertAfter(null, 'paragraph').id, 'start');
  };

  const pickType = (type: BlockType) => {
    const target = blocks.find((b) => b.id === menu?.blockId) ?? null;
    setMenu(null);
    if (menu?.mode === 'convert' && target) {
      api.convert(target, type);
      if (type === 'image') api.attach('library', { ...target, type: 'image', data: { image: null } } as Block);
      if (type === 'file') api.attach('file', { ...target, type: 'file', data: { file: null } } as Block);
    } else {
      const created = api.insertAfter(target ?? blocks[blocks.length - 1] ?? null, type);
      if (type === 'image') api.attach('library', created);
      else if (type === 'file') api.attach('file', created);
      else api.focus(created.id, 'start');
    }
  };

  const header = (
    <View style={styles.header}>
      <TextInput
        value={title}
        placeholder="Untitled"
        placeholderTextColor={colors.textFaint}
        multiline
        submitBehavior="submit"
        onFocus={() => {
          titleFocused.current = true;
          api.setFocused(null);
        }}
        onBlur={() => {
          titleFocused.current = false;
          titleSaver.flush();
        }}
        onChangeText={(t) => {
          setTitle(t);
          titleSaver.call(t);
        }}
        onSubmitEditing={() => {
          titleSaver.flush();
          if (blocks[0]) api.focus(blocks[0].id, 'start');
          else appendParagraph();
        }}
        style={[styles.title, { color: colors.text }]}
      />
      <Text style={[styles.noteMeta, { color: colors.textFaint }]}>
        Created {formatTimestamp(note.createdAt)} · Edited {formatTimestamp(note.updatedAt)}
      </Text>
    </View>
  );

  const footer = loading ? undefined : (
    <Pressable onPress={appendParagraph} style={styles.addBlock} accessibilityRole="button">
      <Icon name="add" size={18} color={colors.textFaint} />
      <Text style={{ color: colors.textFaint, fontSize: 15 }}>Tap to add a block</Text>
    </Pressable>
  );

  return (
    <EditorContext.Provider value={api}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}>
        <DraggableFlatList
          data={blocks}
          keyExtractor={(b) => b.id}
          activationDistance={12}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={styles.list}
          onDragEnd={({ from, to }) => {
            const moved = blocks[from];
            if (moved && from !== to) service.moveBlock(moved, blocks, to);
          }}
          renderItem={({ item, drag, isActive }) => <BlockItem block={item} drag={drag} isActive={isActive} />}
        />

        {selectedBlock && !focusedBlock && (
          <View style={[styles.selectionBar, { backgroundColor: colors.bgSoft, borderTopColor: colors.border }]}>
            <Text style={{ color: colors.textSoft, flex: 1 }} numberOfLines={1}>
              Created {formatTimestamp(selectedBlock.createdAt)}
            </Text>
            <Pressable onPress={() => setMenu({ blockId: selectedBlock.id, mode: 'convert' })} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Turn into</Text>
            </Pressable>
            <Pressable onPress={() => api.remove(selectedBlock)} hitSlop={8}>
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Delete</Text>
            </Pressable>
          </View>
        )}

        {focusedBlock && (
          <KeyboardToolbar
            block={focusedBlock}
            activeMarks={marks}
            onMark={(mark) => {
              const controller = controllers.current.get(focusedBlock.id);
              controller?.toggleMark(mark);
              setMarks(controller?.activeMarks() ?? []);
            }}
            onType={(type) => api.convert(focusedBlock, type)}
            onInsert={(type) => {
              const created = api.insertAfter(focusedBlock, type);
              api.setFocused(null);
              setSelectedId(created.id);
            }}
            onAttach={(source) => api.attach(source, focusedBlock)}
            onMore={() => setMenu({ blockId: focusedBlock.id, mode: 'insert' })}
          />
        )}
      </KeyboardAvoidingView>

      <TypeMenu
        visible={!!menu}
        title={menu?.mode === 'convert' ? 'Turn into' : 'Insert block'}
        onPick={pickType}
        onClose={() => setMenu(null)}
      />
    </EditorContext.Provider>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 8, paddingBottom: 220 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 36, padding: 0 },
  noteMeta: { fontSize: 12, marginTop: 6 },
  addBlock: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 30 },
  selectionBar: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
