// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import {
  type SettingsHistory,
  MAX_HISTORY_ENTRIES,
  canGoBack,
  canGoForward,
  getCurrentEntry,
  goBack,
  goForward,
  recordNavigation,
} from './history';

describe('recordNavigation', () => {
  it('initializes empty history with the first entry', () => {
    const next = recordNavigation({ entries: [], index: -1 }, '/settings/appearance');
    expect(next).toEqual({ entries: ['/settings/appearance'], index: 0 });
  });

  it('no-ops when pathname matches the current entry', () => {
    const prev: SettingsHistory = { entries: ['/settings/appearance'], index: 0 };
    const next = recordNavigation(prev, '/settings/appearance');
    expect(next).toBe(prev);
  });

  it('advances the index when pathname matches the next entry (forward echo)', () => {
    const prev: SettingsHistory = { entries: ['/settings/appearance', '/settings/privacy/permissions'], index: 0 };
    const next = recordNavigation(prev, '/settings/privacy/permissions');
    expect(next.index).toBe(1);
    expect(next.entries).toEqual(prev.entries);
  });

  it('rewinds the index when pathname matches the previous entry (back echo)', () => {
    const prev: SettingsHistory = { entries: ['/settings/appearance', '/settings/privacy/permissions'], index: 1 };
    const next = recordNavigation(prev, '/settings/appearance');
    expect(next.index).toBe(0);
    expect(next.entries).toEqual(prev.entries);
  });

  it('truncates forward entries when a new pathname is recorded after a back', () => {
    const prev: SettingsHistory = {
      entries: ['/settings/appearance', '/settings/privacy/permissions', '/settings/privacy/apps'],
      index: 1,
    };
    const next = recordNavigation(prev, '/settings/development/network');
    expect(next.entries).toEqual(['/settings/appearance', '/settings/privacy/permissions', '/settings/development/network']);
    expect(next.index).toBe(2);
  });

  it('enforces the entry cap by dropping oldest entries', () => {
    const entries = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => `/settings/p${i}`);
    const prev: SettingsHistory = { entries, index: MAX_HISTORY_ENTRIES - 1 };
    const next = recordNavigation(prev, '/settings/overflow');

    expect(next.entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(next.entries[0]).toBe('/settings/p1');
    expect(next.entries[MAX_HISTORY_ENTRIES - 1]).toBe('/settings/overflow');
    expect(next.index).toBe(MAX_HISTORY_ENTRIES - 1);
  });
});

describe('goBack / goForward', () => {
  it('goBack decrements index', () => {
    const prev: SettingsHistory = { entries: ['/a', '/b'], index: 1 };
    expect(goBack(prev)).toEqual({ entries: prev.entries, index: 0 });
  });

  it('goBack no-ops at the start', () => {
    const prev: SettingsHistory = { entries: ['/a'], index: 0 };
    expect(goBack(prev)).toBe(prev);
  });

  it('goForward increments index', () => {
    const prev: SettingsHistory = { entries: ['/a', '/b'], index: 0 };
    expect(goForward(prev)).toEqual({ entries: prev.entries, index: 1 });
  });

  it('goForward no-ops at the end', () => {
    const prev: SettingsHistory = { entries: ['/a', '/b'], index: 1 };
    expect(goForward(prev)).toBe(prev);
  });
});

describe('canGoBack / canGoForward', () => {
  it('canGoBack true when index > 0', () => {
    expect(canGoBack({ entries: ['/a', '/b'], index: 1 })).toBe(true);
    expect(canGoBack({ entries: ['/a'], index: 0 })).toBe(false);
    expect(canGoBack({ entries: [], index: -1 })).toBe(false);
  });

  it('canGoForward true when index < entries.length - 1', () => {
    expect(canGoForward({ entries: ['/a', '/b'], index: 0 })).toBe(true);
    expect(canGoForward({ entries: ['/a', '/b'], index: 1 })).toBe(false);
    expect(canGoForward({ entries: [], index: -1 })).toBe(false);
  });
});

describe('getCurrentEntry', () => {
  it('returns the entry at the current index', () => {
    const history: SettingsHistory = { entries: ['/a', '/b'], index: 1 };
    expect(getCurrentEntry(history)).toBe('/b');
  });

  it('returns null for empty history', () => {
    expect(getCurrentEntry({ entries: [], index: -1 })).toBeNull();
  });
});
