import { describe, expect, it } from 'vitest';

import { removeAliveTab, touchAliveTab } from './alive';

describe('touchAliveTab', () => {
  it('adds new id to front of empty list', () => {
    expect(touchAliveTab([], 'a')).toEqual(['a']);
  });

  it('adds new id to front', () => {
    expect(touchAliveTab(['b', 'c'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('moves existing id to front', () => {
    expect(touchAliveTab(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('no-op when id is already at front', () => {
    expect(touchAliveTab(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('trims list to MAX_ALIVE_TABS', () => {
    const aliveTabs = Array.from({ length: 6 }, (_, i) => `id-${i}`);
    const result = touchAliveTab(aliveTabs, 'new');

    expect(result).toHaveLength(6);
    expect(result[0]).toBe('new');
    expect(result).not.toContain(`id-${5}`);
  });
});

describe('removeAliveTab', () => {
  it('removes existing id', () => {
    expect(removeAliveTab(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('no-op for missing id', () => {
    expect(removeAliveTab(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });

  it('returns empty array when removing last item', () => {
    expect(removeAliveTab(['a'], 'a')).toEqual([]);
  });
});
