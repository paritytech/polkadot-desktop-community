import { createState } from '@/shared/rxstate';

export type SettingsHistory = { entries: string[]; index: number };

export const MAX_HISTORY_ENTRIES = 50;

export const EMPTY_HISTORY: SettingsHistory = { entries: [], index: -1 };

export const recordNavigation = (history: SettingsHistory, pathname: string): SettingsHistory => {
  if (history.entries.length === 0) {
    return { entries: [pathname], index: 0 };
  }

  const current = history.entries[history.index];
  if (current === pathname) {
    return history;
  }

  const next = history.entries[history.index + 1];
  if (next === pathname) {
    return { ...history, index: history.index + 1 };
  }

  const prev = history.entries[history.index - 1];
  if (prev === pathname) {
    return { ...history, index: history.index - 1 };
  }

  const truncated = history.entries.slice(0, history.index + 1);
  truncated.push(pathname);

  if (truncated.length <= MAX_HISTORY_ENTRIES) {
    return { entries: truncated, index: truncated.length - 1 };
  }

  const dropped = truncated.length - MAX_HISTORY_ENTRIES;
  return {
    entries: truncated.slice(dropped),
    index: truncated.length - dropped - 1,
  };
};

export const goBack = (history: SettingsHistory): SettingsHistory => {
  if (history.index <= 0) return history;
  return { ...history, index: history.index - 1 };
};

export const goForward = (history: SettingsHistory): SettingsHistory => {
  if (history.index >= history.entries.length - 1) return history;
  return { ...history, index: history.index + 1 };
};

export const canGoBack = (history: SettingsHistory): boolean => history.index > 0;

export const canGoForward = (history: SettingsHistory): boolean => history.index < history.entries.length - 1;

export const getCurrentEntry = (history: SettingsHistory): string | null => history.entries[history.index] ?? null;

export const settingsHistory$ = createState<SettingsHistory>(EMPTY_HISTORY);
