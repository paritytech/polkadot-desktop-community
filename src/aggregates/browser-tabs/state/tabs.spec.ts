// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';

import { type Tab, type TabRef, browserTabs, decodePersistedTabs, encodePersistedTabs } from './tabs';

const tab = (id: string, type: string, deeplink = '', tabKey = 'k', persistable = true): Tab => ({
  id,
  type,
  deeplink,
  tabKey,
  persistable,
});

beforeEach(() => {
  browserTabs.tabs$.set([]);
  browserTabs.selectedTabId$.set(null);
});

describe('selection', () => {
  it('selectTab sets selectedTabId$', () => {
    browserTabs.selectTab('foo.dot');
    expect(browserTabs.selectedTabId$.get()).toBe('foo.dot');
    browserTabs.selectTab(null);
    expect(browserTabs.selectedTabId$.get()).toBeNull();
  });
});

describe('addTab', () => {
  it('adds a tab with tabKey + persistable flag', () => {
    browserTabs.addTab({ id: 'foo.dot', type: 'product', deeplink: '' }, { persistable: true });
    const [t] = browserTabs.tabs$.get();
    expect(t).toMatchObject({ id: 'foo.dot', type: 'product', deeplink: '', persistable: true });
    expect(typeof t!.tabKey).toBe('string');
  });

  it('dedups by id and updates deeplink when it differs', () => {
    browserTabs.addTab({ id: 'foo.dot', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: 'foo.dot', type: 'product', deeplink: '/swap' }, { persistable: true });
    expect(browserTabs.tabs$.get()).toHaveLength(1);
    expect(browserTabs.tabs$.get()[0]!.deeplink).toBe('/swap');
  });

  it('prepends when asked', () => {
    browserTabs.addTab({ id: 'a.dot', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: 'b', type: 'new-tab', deeplink: '' }, { persistable: false, prepend: true });
    expect(browserTabs.tabs$.get().map(t => t.id)).toEqual(['b', 'a.dot']);
  });
});

describe('replaceTabIdentifier', () => {
  it('swaps id + type in place, keeps tabKey, updates persistable', () => {
    browserTabs.addTab({ id: 'nt-1', type: 'new-tab', deeplink: '' }, { persistable: false });
    const key = browserTabs.tabs$.get()[0]!.tabKey;
    browserTabs.replaceTabIdentifier('nt-1', { id: 'foo.dot', type: 'product', deeplink: '/x' }, { persistable: true });
    const [t] = browserTabs.tabs$.get();
    expect(t).toMatchObject({ id: 'foo.dot', type: 'product', deeplink: '/x', persistable: true, tabKey: key });
  });
});

describe('updateTabDeeplink / removeTab / reorderTabs', () => {
  it('updateTabDeeplink updates by id', () => {
    browserTabs.addTab({ id: 'foo.dot', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.updateTabDeeplink('foo.dot', '/trade');
    expect(browserTabs.tabs$.get()[0]!.deeplink).toBe('/trade');
  });

  it('removeTab removes by id', () => {
    browserTabs.addTab({ id: 'foo.dot', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.removeTab('foo.dot');
    expect(browserTabs.tabs$.get()).toEqual([]);
  });

  it('reorderTabs moves a tab', () => {
    browserTabs.addTab({ id: 'a', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: 'b', type: 'product', deeplink: '' }, { persistable: true });
    browserTabs.reorderTabs('a', 'b');
    expect(browserTabs.tabs$.get().map(t => t.id)).toEqual(['b', 'a']);
  });
});

describe('encodePersistedTabs / decodePersistedTabs', () => {
  it('encodes only persistable tabs and round-trips', () => {
    const tabs: Tab[] = [tab('foo.dot', 'product', '/bar', 'k1', true), tab('nt-1', 'new-tab', '', 'k2', false)];
    expect(decodePersistedTabs(encodePersistedTabs(tabs))).toEqual([tab('foo.dot', 'product', '/bar', 'k1', true)]);
  });

  it('drops malformed entries and defaults persistable:true + a tabKey', () => {
    const raw = JSON.stringify([
      null,
      { id: 'foo.dot' },
      { id: 'foo.dot', type: 'product' },
      { id: 'foo.dot', type: 'product', deeplink: '/ok', tabKey: 'k-ok' },
      { id: 'bar.dot', type: 'product', deeplink: '' },
    ]);
    const decoded = decodePersistedTabs(raw);
    expect(decoded).toEqual([
      tab('foo.dot', 'product', '/ok', 'k-ok', true),
      expect.objectContaining({ id: 'bar.dot', type: 'product', deeplink: '', persistable: true }),
    ]);
    expect(typeof decoded[1]!.tabKey).toBe('string');
  });

  it('returns empty for non-array json', () => {
    expect(decodePersistedTabs('null')).toEqual([]);
    expect(decodePersistedTabs('{}')).toEqual([]);
  });
});

// satisfies the unused-type lint if TabRef isn't otherwise referenced
const _ref: TabRef = { id: 'x', type: 'y', deeplink: '' };
void _ref;
