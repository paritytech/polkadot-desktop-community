// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
  type TabHistory,
  MAX_HISTORY_ENTRIES,
  canGoBack,
  canGoForward,
  decodeTabHistories,
  encodeTabHistories,
  getCurrentEntry,
  goBack,
  goForward,
  recordNavigation,
} from './history';

const entry = (id: string, deeplink = '') => ({ id, type: 'product', deeplink });

describe('recordNavigation', () => {
  it('initializes empty history with the first entry', () => {
    const next = recordNavigation(undefined, entry('a.dot'));
    expect(next).toEqual({ entries: [entry('a.dot')], index: 0 });
  });

  it('no-ops when url matches the current entry', () => {
    const prev: TabHistory = { entries: [entry('a.dot')], index: 0 };
    const next = recordNavigation(prev, entry('a.dot'));
    expect(next).toBe(prev);
  });

  it('advances the index when url matches the next entry (forward echo)', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 0 };
    const next = recordNavigation(prev, entry('b.dot'));
    expect(next.index).toBe(1);
    expect(next.entries).toEqual(prev.entries);
  });

  it('rewinds the index when url matches the previous entry (back echo)', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 1 };
    const next = recordNavigation(prev, entry('a.dot'));
    expect(next.index).toBe(0);
    expect(next.entries).toEqual(prev.entries);
  });

  it('truncates forward entries when a new url is recorded after a back', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot'), entry('c.dot')], index: 1 };
    const next = recordNavigation(prev, entry('d.dot'));
    expect(next.entries).toEqual([entry('a.dot'), entry('b.dot'), entry('d.dot')]);
    expect(next.index).toBe(2);
  });

  it('enforces the entry cap by dropping oldest entries', () => {
    const entries = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => entry(`p${i}.dot`));
    const prev: TabHistory = { entries, index: MAX_HISTORY_ENTRIES - 1 };
    const next = recordNavigation(prev, entry('overflow.dot'));

    expect(next.entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(next.entries[0]).toEqual(entry('p1.dot'));
    expect(next.entries[MAX_HISTORY_ENTRIES - 1]).toEqual(entry('overflow.dot'));
    expect(next.index).toBe(MAX_HISTORY_ENTRIES - 1);
  });

  it('treats differing pathnames as new entries', () => {
    const prev: TabHistory = { entries: [entry('a.dot', '/foo')], index: 0 };
    const next = recordNavigation(prev, entry('a.dot', '/bar'));
    expect(next.entries).toEqual([entry('a.dot', '/foo'), entry('a.dot', '/bar')]);
    expect(next.index).toBe(1);
  });
});

describe('goBack / goForward', () => {
  it('goBack decrements index', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 1 };
    expect(goBack(prev)).toEqual({ entries: prev.entries, index: 0 });
  });

  it('goBack no-ops at the start', () => {
    const prev: TabHistory = { entries: [entry('a.dot')], index: 0 };
    expect(goBack(prev)).toBe(prev);
  });

  it('goForward increments index', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 0 };
    expect(goForward(prev)).toEqual({ entries: prev.entries, index: 1 });
  });

  it('goForward no-ops at the end', () => {
    const prev: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 1 };
    expect(goForward(prev)).toBe(prev);
  });

  it('both no-op on undefined history', () => {
    expect(goBack(undefined)).toBeUndefined();
    expect(goForward(undefined)).toBeUndefined();
  });
});

describe('canGoBack / canGoForward', () => {
  it('canGoBack true when index > 0', () => {
    expect(canGoBack({ entries: [entry('a.dot'), entry('b.dot')], index: 1 })).toBe(true);
    expect(canGoBack({ entries: [entry('a.dot')], index: 0 })).toBe(false);
    expect(canGoBack(undefined)).toBe(false);
  });

  it('canGoForward true when index < entries.length - 1', () => {
    expect(canGoForward({ entries: [entry('a.dot'), entry('b.dot')], index: 0 })).toBe(true);
    expect(canGoForward({ entries: [entry('a.dot'), entry('b.dot')], index: 1 })).toBe(false);
    expect(canGoForward(undefined)).toBe(false);
  });
});

describe('getCurrentEntry', () => {
  it('returns the entry at the current index', () => {
    const history: TabHistory = { entries: [entry('a.dot'), entry('b.dot')], index: 1 };
    expect(getCurrentEntry(history)).toEqual(entry('b.dot'));
  });

  it('returns null for undefined history', () => {
    expect(getCurrentEntry(undefined)).toBeNull();
  });
});

describe('encodeTabHistories / decodeTabHistories', () => {
  it('round-trips valid histories', () => {
    const histories = {
      k1: { entries: [entry('a.dot'), entry('b.dot', '/x')], index: 1 },
      k2: { entries: [entry('new-tab:abc'), entry('c.dot')], index: 0 },
    };
    expect(decodeTabHistories(encodeTabHistories(histories))).toEqual(histories);
  });

  it('drops malformed entries and clamps index', () => {
    const raw = JSON.stringify({
      k1: { entries: [{ id: 'a.dot', type: 'product', deeplink: '' }, { bogus: true }], index: 99 },
      k2: 'not-an-object',
      k3: { entries: 'not-an-array', index: 0 },
      k4: { entries: [], index: 0 },
    });
    expect(decodeTabHistories(raw)).toEqual({
      k1: { entries: [entry('a.dot')], index: 0 },
    });
  });

  it('returns empty object on non-object json', () => {
    expect(decodeTabHistories('null')).toEqual({});
    expect(decodeTabHistories('[]')).toEqual({});
    expect(decodeTabHistories('"string"')).toEqual({});
  });
});
