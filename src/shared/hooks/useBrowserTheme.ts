import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'polkadot_theme_mode';
const THEME_CHANGE_EVENT = 'polkadot-theme-change';

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const readPreference = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  } catch {
    return 'system';
  }
};

const resolve = (preference: ThemePreference): ResolvedTheme => {
  return preference === 'system' ? getSystemTheme() : preference;
};

export const saveTheme = (preference: ThemePreference) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
};

export const useThemePreference = (): ThemePreference => {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const sync = () => setPreference(readPreference());
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return preference;
};

export const useBrowserTheme = (): ResolvedTheme => {
  const preference = useThemePreference();
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(preference));

  useEffect(() => {
    setResolved(resolve(preference));
    if (preference !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setResolved(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [preference]);

  return resolved;
};
