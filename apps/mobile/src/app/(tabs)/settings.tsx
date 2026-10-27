import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip, Icon, SyncPill } from '@/components/ui';
import { useSession } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import { drainCaptures, widgetsAvailable } from '@/lib/widgets';

export default function SettingsScreen() {
  const { user, signOut, service } = useSession();
  const { colors, preference, setPreference } = useTheme();
  const section = (title: string) => <Text style={[styles.section, { color: colors.textFaint }]}>{title}</Text>;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 48 }}>
      {section('ACCOUNT')}
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.account}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{(user?.displayName ?? '?')[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{user?.displayName}</Text>
            <Text style={{ color: colors.textSoft }}>{user?.email}</Text>
          </View>
        </View>
        <SyncPill />
        <Text style={{ color: colors.textSoft, lineHeight: 20 }}>
          Notes are stored on this device and in your Google-linked cloud account. They sync automatically when you are online and are restored on any device where you sign in.
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert('Sign out?', 'Your notes stay safe in the cloud and come back when you sign in again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={styles.action}
        >
          <Icon name="log-out-outline" color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 16 }}>Sign out</Text>
        </Pressable>
      </View>

      {section('APPEARANCE')}
      <View style={styles.chips}>
        <Chip icon="phone-portrait-outline" label="System" selected={preference === 'system'} onPress={() => setPreference('system')} />
        <Chip icon="sunny-outline" label="Light" selected={preference === 'light'} onPress={() => setPreference('light')} />
        <Chip icon="moon-outline" label="Dark" selected={preference === 'dark'} onPress={() => setPreference('dark')} />
      </View>

      {section('HOME SCREEN WIDGETS')}
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Quick Note</Text>
        <Text style={{ color: colors.textSoft, lineHeight: 20 }}>
          {Platform.OS === 'android'
            ? 'Tap the Drive or Folder chip to switch where notes go, then tap “Write a note…” to type in a floating box over your home screen — the app does not open. Saved notes sync in the background.'
            : 'Tap the Drive or Folder chip to switch where notes go right in the widget, then tap “Write a note…” to jump straight into a capture sheet.'}
        </Text>
        <Text style={{ color: colors.text, fontWeight: '600', marginTop: 6 }}>Notes carousel</Text>
        <Text style={{ color: colors.textSoft, lineHeight: 20 }}>
          {Platform.OS === 'android'
            ? 'Swipe through note cards; tap one to open it. Tap ⚙ to show recent notes, pinned notes, a Drive or a Folder.'
            : 'Flip through note cards with the arrows; tap one to open it. Long-press → Edit Widget to show recent notes, pinned notes, a Drive or a Folder.'}
        </Text>
        <Text style={{ color: colors.textFaint, fontSize: 13 }}>
          {widgetsAvailable ? 'Widgets are connected.' : 'Widgets need a development or store build (not Expo Go).'}
        </Text>
        {widgetsAvailable && service && (
          <Pressable
            style={styles.action}
            onPress={async () => {
              const n = await drainCaptures(service);
              Alert.alert('Widget notes', n ? `Synced ${n} quick note${n === 1 ? '' : 's'}.` : 'Nothing waiting to sync.');
            }}
          >
            <Icon name="sync-outline" color={colors.accent} />
            <Text style={{ color: colors.accent, fontSize: 16 }}>Sync widget notes now</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, gap: 10 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
