import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useSession } from '@/lib/session';
import { useColors } from '@/lib/theme';
import { Icon } from './ui';

export function SignInScreen() {
  const { signInWithGoogle, error } = useSession();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bgSoft }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>SNote</Text>
        <Text style={[styles.tagline, { color: colors.textSoft }]}>
          Block-based notes in Drives and Folders. Works offline, syncs everywhere, and remembers when every block was written.
        </Text>
        <Pressable
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await signInWithGoogle();
            setBusy(false);
          }}
          style={({ pressed }) => [styles.google, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator /> : <Icon name="logo-google" color={colors.text} />}
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Continue with Google</Text>
        </Pressable>
        <Text style={[styles.hint, { color: colors.textFaint }]}>Your notes are restored automatically on any device where you sign in.</Text>
        {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 18, padding: 28, gap: 16, alignItems: 'stretch' },
  logo: { alignSelf: 'center', width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  tagline: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingVertical: 14 },
  hint: { fontSize: 13, textAlign: 'center' },
});
