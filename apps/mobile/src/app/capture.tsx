import { newCapture } from '@snote/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TargetPicker } from '@/components/TargetPicker';
import { useDrives, useFolders } from '@/lib/hooks';
import { prefs, type CaptureTarget } from '@/lib/prefs';
import { useService } from '@/lib/session';
import { useColors } from '@/lib/theme';

/**
 * Minimal Quick Capture sheet. Opened from the iOS Quick Note widget
 * (`snote://capture?driveId=&folderId=&prefill=`), the header ✎ button, or
 * anywhere in the app. Saving writes locally first and syncs in the background.
 */
export default function CaptureScreen() {
  const params = useLocalSearchParams<{ driveId?: string; folderId?: string; prefill?: string }>();
  const colors = useColors();
  const service = useService();
  const drives = useDrives();
  const folders = useFolders();
  const [text, setText] = useState(params.prefill ?? '');
  const [target, setTarget] = useState<CaptureTarget | null>(
    params.driveId && params.folderId ? { driveId: params.driveId, folderId: params.folderId } : null,
  );

  // Default to the last used Drive/Folder, else the first available folder.
  useEffect(() => {
    if (target && folders.some((f) => f.id === target.folderId)) return;
    void prefs.lastTarget().then((last) => {
      if (last && folders.some((f) => f.id === last.folderId)) setTarget(last);
      else if (folders[0]) setTarget({ driveId: folders[0].driveId, folderId: folders[0].id });
    });
  }, [folders, target]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else if (Platform.OS === 'android') BackHandler.exitApp(); // launched from the widget: return to the home screen
    else router.replace('/');
  };

  const save = async () => {
    if (!target || !text.trim()) return;
    await service.ingestCapture(newCapture(text, target, 'app'));
    await prefs.setLastTarget(target);
    close();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TargetPicker drives={drives} folders={folders} value={target} onChange={setTarget} />
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder={'First line becomes the title.\n[ ] item → to-do  ·  - item → bullet'}
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { color: colors.text, backgroundColor: colors.bgSoft }]}
        />
      </ScrollView>
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Pressable onPress={close} style={styles.button}>
          <Text style={{ color: colors.textSoft, fontSize: 16 }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!target || !text.trim()}
          style={[styles.button, styles.primary, { backgroundColor: colors.accent, opacity: !target || !text.trim() ? 0.5 : 1 }]}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save note</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  input: { minHeight: 180, borderRadius: 12, padding: 14, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  button: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  primary: {},
});
