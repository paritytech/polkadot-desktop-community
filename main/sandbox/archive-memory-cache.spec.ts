import { describe, expect, it } from 'vitest';

import { type ProductArchive } from '@/domains/product';

import { createArchiveMemoryCache } from './archive-memory-cache';

const archive = (bytes: number): ProductArchive => ({ domain: 'd', origin: 'o', files: { f: new Uint8Array(bytes) } });

describe('createArchiveMemoryCache', () => {
  it('stores and returns an archive by domain', () => {
    const cache = createArchiveMemoryCache(1000);
    cache.set('app.x.dot', archive(10), false);
    expect(cache.get('app.x.dot')).toBeDefined();
    expect(cache.stats().size).toBe(1);
  });

  it('tracks total bytes and frees them on delete', () => {
    const cache = createArchiveMemoryCache(1000);
    cache.set('a', archive(100), true);
    cache.set('b', archive(50), true);
    expect(cache.stats().totalBytes).toBe(150);
    cache.delete('a');
    expect(cache.stats().totalBytes).toBe(50);
  });

  it('evicts disk-backed entries oldest-first when over the byte cap', () => {
    const cache = createArchiveMemoryCache(250);
    cache.set('old', archive(100), true);
    cache.set('mid', archive(100), true);
    cache.set('new', archive(100), true); // 300 > 250 → evict oldest disk-backed
    expect(cache.get('old')).toBeUndefined();
    expect(cache.get('mid')).toBeDefined();
    expect(cache.get('new')).toBeDefined();
    expect(cache.stats().totalBytes).toBe(200);
  });

  it('never evicts non-disk-backed entries even when over cap', () => {
    const cache = createArchiveMemoryCache(150);
    cache.set('live1', archive(100), false);
    cache.set('live2', archive(100), false); // 200 > 150 but neither is evictable
    expect(cache.get('live1')).toBeDefined();
    expect(cache.get('live2')).toBeDefined();
    expect(cache.stats().totalBytes).toBe(200);
  });

  it('a get bumps recency so the bumped entry survives eviction', () => {
    const cache = createArchiveMemoryCache(250);
    cache.set('a', archive(100), true);
    cache.set('b', archive(100), true);
    cache.get('a'); // bump a → b becomes oldest
    cache.set('c', archive(100), true); // 300 > 250 → evict oldest = b
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('clear empties the cache and resets the byte count', () => {
    const cache = createArchiveMemoryCache(1000);
    cache.set('a', archive(100), true);
    cache.clear();
    expect(cache.stats().size).toBe(0);
    expect(cache.stats().totalBytes).toBe(0);
  });

  it('self-evicts an oversized disk-backed entry (served from disk instead)', () => {
    const cache = createArchiveMemoryCache(50);
    cache.set('big', archive(100), true);
    expect(cache.get('big')).toBeUndefined();
    expect(cache.stats().totalBytes).toBe(0);
  });

  it('keeps an oversized non-disk-backed entry (not re-servable, must not drop)', () => {
    const cache = createArchiveMemoryCache(50);
    cache.set('big', archive(100), false);
    expect(cache.get('big')).toBeDefined();
    expect(cache.stats().totalBytes).toBe(100);
  });

  it('re-set updates diskBacked so a now-disk-backed entry becomes evictable', () => {
    const cache = createArchiveMemoryCache(150);
    cache.set('a', archive(100), false); // not evictable yet
    cache.set('a', archive(100), true); // re-set: now disk-backed (and newest)
    cache.set('b', archive(100), true); // 200 > 150 → 'a' (older, now evictable) is dropped
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
  });
});
