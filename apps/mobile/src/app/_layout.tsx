import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SignInScreen } from '@/components/SignInScreen';
import { WidgetBridge } from '@/components/WidgetBridge';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useColors } from '@/lib/theme';
import { clearSnapshot } from '@/lib/widgets';

function Root() {
  const { ready, user } = useSession();
  const colors = useColors();

  useEffect(() => {
    if (ready && !user) clearSnapshot();
  }, [ready, user]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!user) return <SignInScreen />;

  return (
    <>
      <WidgetBridge />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="folder/[id]" options={{ title: '' }} />
        <Stack.Screen name="note/[id]" options={{ title: '' }} />
        <Stack.Screen name="capture" options={{ presentation: 'modal', title: 'Quick note' }} />
      </Stack>
    </>
  );
}

function Themed() {
  const colors = useColors();
  return (
    <>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <Root />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <Themed />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
