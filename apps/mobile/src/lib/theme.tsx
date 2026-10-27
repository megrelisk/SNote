import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { prefs, type ThemePreference } from './prefs';

const light = {
  dark: false,
  bg: '#FFFFFF',
  bgSoft: '#F7F7F5',
  card: '#FFFFFF',
  hover: 'rgba(55,53,47,0.06)',
  border: 'rgba(55,53,47,0.12)',
  text: '#37352F',
  textSoft: 'rgba(55,53,47,0.65)',
  textFaint: 'rgba(55,53,47,0.4)',
  accent: '#2F6FEB',
  accentSoft: 'rgba(47,111,235,0.12)',
  danger: '#D44C47',
  success: '#2F9E6B',
  warn: '#C98A12',
  codeBg: 'rgba(135,131,120,0.15)',
  codeText: '#C4554D',
};

export type Colors = typeof light;

const dark: Colors = {
  dark: true,
  bg: '#191919',
  bgSoft: '#202020',
  card: '#252525',
  hover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  text: 'rgba(255,255,255,0.88)',
  textSoft: 'rgba(255,255,255,0.6)',
  textFaint: 'rgba(255,255,255,0.35)',
  accent: '#5B8DEF',
  accentSoft: 'rgba(91,141,239,0.18)',
  danger: '#FF6B66',
  success: '#4CC38A',
  warn: '#E0A43A',
  codeBg: 'rgba(255,255,255,0.08)',
  codeText: '#FF8A80',
};

interface ThemeValue {
  colors: Colors;
  preference: ThemePreference;
  setPreference(p: ThemePreference): void;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, preference: 'system', setPreference: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    prefs.theme().then(setPref).catch(() => {});
  }, []);
  const value = useMemo<ThemeValue>(() => {
    const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
    return {
      colors: isDark ? dark : light,
      preference,
      setPreference: (p) => {
        setPref(p);
        void prefs.setTheme(p);
      },
    };
  }, [preference, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}
