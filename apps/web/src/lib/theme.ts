'use client';

import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'snote.theme';

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemePreference | null) ?? 'system';
    setPref(stored);
    apply(stored);
  }, []);
  const cycle = useCallback(() => {
    setPref((current) => {
      const next: ThemePreference = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
      localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);
  return { pref, cycle };
}

/** Inline script that applies the stored theme before first paint (no flash). */
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
