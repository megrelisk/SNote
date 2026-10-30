import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEYS = {
  lastTarget: 'snote.lastTarget',
  theme: 'snote.theme',
} as const;

export interface CaptureTarget {
  driveId: string;
  folderId: string;
}

export const prefs = {
  async lastTarget(): Promise<CaptureTarget | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.lastTarget);
      return raw ? (JSON.parse(raw) as CaptureTarget) : null;
    } catch {
      return null;
    }
  },
  setLastTarget(target: CaptureTarget) {
    return AsyncStorage.setItem(KEYS.lastTarget, JSON.stringify(target));
  },
  async theme(): Promise<ThemePreference> {
    const raw = await AsyncStorage.getItem(KEYS.theme);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  },
  setTheme(theme: ThemePreference) {
    return AsyncStorage.setItem(KEYS.theme, theme);
  },
};
