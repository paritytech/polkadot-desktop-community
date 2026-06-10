import { arrayMove } from '@dnd-kit/sortable';
import { nanoid } from 'nanoid';

import { createEventStream, createState, persistLocalStorage } from '@/shared/rxstate';

import { removeAliveTab, touchAliveTab } from './alive';

export type TabRef = { id: string; type: string; deeplink: string };
export type Tab = TabRef & { tabKey: string; persistable: boolean };

const createTabKey = () => nanoid(12);

const tabs$ = createState<Tab[]>([]);
const selectedTabId$ = createState<string | null>(null);
const aliveTabs$ = createState<string[]>([]);
const sameTabClicked$ = createEventStream();

// Exported for the co-located spec only — not part of the browserTabs public surface.
export const encodePersistedTabs = (value: Tab[]): string => JSON.stringify(value.filter(tab => tab.persistable));

export const decodePersistedTabs = (raw: string): Tab[] => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const result: Tab[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record: Record<string, unknown> = { ...entry };
    const { id, type, deeplink, tabKey } = record;
    if (typeof id !== 'string' || typeof type !== 'string' || typeof deeplink !== 'string') continue;
    result.push({
      id,
      type,
      deeplink,
      tabKey: typeof tabKey === 'string' ? tabKey : createTabKey(),
      persistable: true,
    });
  }
  return result;
};

persistLocalStorage(tabs$, {
  key: 'browser_tabs_v2',
  sync: true,
  encode: encodePersistedTabs,
  decode: decodePersistedTabs,
});

persistLocalStorage(selectedTabId$, {
  key: 'browser_selected_tab_v1',
  sync: true,
  encode: value => JSON.stringify(value),
  decode: raw => {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'string' ? value : null;
  },
});

const selectTab = (id: string | null) => {
  selectedTabId$.set(id);
};

const addTab = (ref: TabRef, options: { persistable: boolean; prepend?: boolean }) => {
  tabs$.set(tabs => {
    const existingIndex = tabs.findIndex(tab => tab.id === ref.id);
    if (existingIndex === -1) {
      const newTab: Tab = { ...ref, tabKey: createTabKey(), persistable: options.persistable };
      return options.prepend ? [newTab, ...tabs] : [...tabs, newTab];
    }
    const existingTab = tabs[existingIndex];
    if (!existingTab || existingTab.deeplink === ref.deeplink) return tabs;
    return tabs.map((tab, index) => (index === existingIndex ? { ...tab, deeplink: ref.deeplink } : tab));
  });
};

const removeTab = (id: string) => {
  tabs$.set(tabs => tabs.filter(t => t.id !== id));
};

const updateTabDeeplink = (id: string, deeplink: string) => {
  tabs$.set(tabs => {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return tabs;
    const existing = tabs[index];
    if (!existing || existing.deeplink === deeplink) return tabs;
    return tabs.map((t, i) => (i === index ? { ...t, deeplink } : t));
  });
};

const replaceTabIdentifier = (oldId: string, next: TabRef, options: { persistable?: boolean } = {}) => {
  tabs$.set(tabs => {
    const index = tabs.findIndex(t => t.id === oldId);
    if (index === -1) return tabs;
    return tabs.map((tab, i) =>
      i === index
        ? {
            ...tab,
            id: next.id,
            type: next.type,
            deeplink: next.deeplink,
            persistable: options.persistable ?? tab.persistable,
          }
        : tab,
    );
  });
};

const reorderTabs = (activeId: string, overId: string) => {
  tabs$.set(tabs => {
    const oldIndex = tabs.findIndex(t => t.id === activeId);
    const newIndex = tabs.findIndex(t => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return tabs;
    return arrayMove(tabs, oldIndex, newIndex);
  });
};

const findTabKey = (tabs: Tab[], id: string): string | null => tabs.find(t => t.id === id)?.tabKey ?? null;

const touchAliveTabId = (id: string) => {
  aliveTabs$.set(prev => touchAliveTab(prev, id));
};

const removeAliveTabId = (id: string) => {
  aliveTabs$.set(prev => removeAliveTab(prev, id));
};

const replaceAliveTabId = (oldId: string, newId: string) => {
  aliveTabs$.set(prev => touchAliveTab(removeAliveTab(prev, oldId), newId));
};

export const browserTabs = {
  tabs$,
  selectedTabId$,
  aliveTabs$,
  sameTabClicked$,
  selectTab,
  addTab,
  removeTab,
  updateTabDeeplink,
  replaceTabIdentifier,
  reorderTabs,
  touchAliveTabId,
  removeAliveTabId,
  replaceAliveTabId,
  findTabKey,
};
