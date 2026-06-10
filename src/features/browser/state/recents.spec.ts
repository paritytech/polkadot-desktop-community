// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_RECENTS, recents } from './recents';

beforeEach(() => {
  recents.recent$.set([]);
  localStorage.clear();
});

describe('recents state', () => {
  it('starts empty', () => {
    expect(recents.recent$.get()).toEqual([]);
  });

  it('persists to localStorage', async () => {
    recents.recent$.set(['a.dot', 'b.dot']);
    await Promise.resolve();
    expect(localStorage.getItem('polkadot_recents/v1_value')).toContain('a.dot');
  });
});

describe('recordRecent', () => {
  it('prepends new entries', () => {
    recents.recordRecent('a.dot');
    recents.recordRecent('b.dot');
    expect(recents.recent$.get()).toEqual(['b.dot', 'a.dot']);
  });

  it('dedupes by moving to front', () => {
    recents.recordRecent('a.dot');
    recents.recordRecent('b.dot');
    recents.recordRecent('a.dot');
    expect(recents.recent$.get()).toEqual(['a.dot', 'b.dot']);
  });

  it('caps at MAX_RECENTS', () => {
    for (let i = 0; i < MAX_RECENTS + 5; i += 1) {
      recents.recordRecent(`x${i}.dot`);
    }
    expect(recents.recent$.get()).toHaveLength(MAX_RECENTS);
    expect(recents.recent$.get()[0]).toBe(`x${MAX_RECENTS + 4}.dot`);
  });
});

describe('removeRecent', () => {
  it('removes the named entry', () => {
    recents.recordRecent('a.dot');
    recents.recordRecent('b.dot');
    recents.removeRecent('a.dot');
    expect(recents.recent$.get()).toEqual(['b.dot']);
  });
});
