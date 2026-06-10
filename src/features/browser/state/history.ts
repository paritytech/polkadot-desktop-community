import { createState, persistLocalStorage } from '@/shared/rxstate';
import { type TabRef, browserTabs } from '@/aggregates/browser-tabs';

export type HistoryEntry = TabRef;
export type TabHistory = { entries: HistoryEntry[]; index: number };
export type TabHistories = Record<string, TabHistory>;

export const MAX_HISTORY_ENTRIES = 50;

const entriesEqual = (a: HistoryEntry, b: HistoryEntry) => a.id === b.id && a.type === b.type && a.deeplink === b.deeplink;

export const recordNavigation = (history: TabHistory | undefined, url: HistoryEntry): TabHistory => {
  if (!history || history.entries.length === 0) {
    return { entries: [url], index: 0 };
  }

  const current = history.entries[history.index];
  if (current && entriesEqual(current, url)) {
    return history;
  }

  const next = history.entries[history.index + 1];
  if (next && entriesEqual(next, url)) {
    return { ...history, index: history.index + 1 };
  }

  const prev = history.entries[history.index - 1];
  if (prev && entriesEqual(prev, url)) {
    return { ...history, index: history.index - 1 };
  }

  const truncated = history.entries.slice(0, history.index + 1);
  truncated.push(url);

  if (truncated.length <= MAX_HISTORY_ENTRIES) {
    return { entries: truncated, index: truncated.length - 1 };
  }

  const dropped = truncated.length - MAX_HISTORY_ENTRIES;
  return {
    entries: truncated.slice(dropped),
    index: truncated.length - dropped - 1,
  };
};

export const goBack = (history: TabHistory | undefined): TabHistory | undefined => {
  if (!history || history.index <= 0) return history;
  return { ...history, index: history.index - 1 };
};

export const goForward = (history: TabHistory | undefined): TabHistory | undefined => {
  if (!history || history.index >= history.entries.length - 1) return history;
  return { ...history, index: history.index + 1 };
};

export const canGoBack = (history: TabHistory | undefined): boolean => !!history && history.index > 0;

export const canGoForward = (history: TabHistory | undefined): boolean => !!history && history.index < history.entries.length - 1;

export const getCurrentEntry = (history: TabHistory | undefined): HistoryEntry | null => {
  if (!history) return null;
  return history.entries[history.index] ?? null;
};

export const encodeTabHistories = (value: TabHistories): string => JSON.stringify(value);

const asRecord = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return { ...raw };
};

const parseEntry = (raw: unknown): HistoryEntry | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const { id, type, deeplink } = record;
  if (typeof id !== 'string' || typeof type !== 'string' || typeof deeplink !== 'string') return null;
  return { id, type, deeplink };
};

export const decodeTabHistories = (raw: string): TabHistories => {
  const rootRecord = asRecord(JSON.parse(raw));
  if (!rootRecord) return {};

  const result: TabHistories = {};
  for (const [tabKey, value] of Object.entries(rootRecord)) {
    const record = asRecord(value);
    if (!record) continue;
    const { entries: entriesRaw, index: indexRaw } = record;
    if (!Array.isArray(entriesRaw) || typeof indexRaw !== 'number') continue;
    const entries = entriesRaw.map(parseEntry).filter((e): e is HistoryEntry => e !== null);
    if (entries.length === 0) continue;
    const index = Math.max(0, Math.min(indexRaw, entries.length - 1));
    result[tabKey] = { entries, index };
  }
  return result;
};

export const tabHistories$ = createState<TabHistories>({});

persistLocalStorage(tabHistories$, {
  key: 'browser_history_v2',
  sync: true,
  encode: encodeTabHistories,
  decode: decodeTabHistories,
});

// Drop histories whose tabKey isn't present in tabs$ (closed tabs, new-tab state on restart).
// Fires on every tabs$ change; distinctUntilChanged on tabHistories$ short-circuits no-op writes.
const pruneDanglingHistories = () => {
  const keys = new Set(browserTabs.tabs$.get().map(t => t.tabKey));
  tabHistories$.set(histories => {
    let changed = false;
    const next: TabHistories = {};
    for (const [tabKey, history] of Object.entries(histories)) {
      if (keys.has(tabKey)) {
        next[tabKey] = history;
      } else {
        changed = true;
      }
    }
    return changed ? next : histories;
  });
};

browserTabs.tabs$.value$.subscribe(pruneDanglingHistories);
tabHistories$.value$.subscribe(pruneDanglingHistories);
