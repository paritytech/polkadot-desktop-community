import { produce } from 'immer';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryResource } from './createQueryResource';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('createQueryResource', () => {
  describe('read$', () => {
    it('should call request function and emit result', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .build();

      const result = await firstValueFrom(resource.read$({ id: '1' }));

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledWith({ id: '1' });
    });

    it('should cache result and not refetch on subsequent reads', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache({ initial: {}, staleAfter: Number.POSITIVE_INFINITY, map: (cache, value, { id }) => ({ ...cache, [id]: value }) })
        .build();

      await firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      const result = await firstValueFrom(resource.read$({ id: '1' }));

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('should force refetch after invalidation', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(`result-${++callCount}`));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      const result1 = await firstValueFrom(resource.read$({ id: '1' }));
      expect(result1).toBe('result-1');

      await flushPromises();

      resource.invalidate({ id: '1' });

      const result2 = await firstValueFrom(resource.read$({ id: '1' }));
      expect(result2).toBe('result-2');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not affect other keys', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(({ id }: { id: string }) => Promise.resolve(`${id}-${++callCount}`));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ id: 'a' }));
      await firstValueFrom(resource.read$({ id: 'b' }));
      await flushPromises();

      expect(fn).toHaveBeenCalledTimes(2);

      resource.invalidate({ id: 'a' });

      const resultA = await firstValueFrom(resource.read$({ id: 'a' }));
      expect(resultA).toBe('a-3');

      const resultB = await firstValueFrom(resource.read$({ id: 'b' }));
      expect(resultB).toBe('b-2');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should clear cache$ entry on invalidate', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(`v${++callCount}`));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      expect(await firstValueFrom(resource.cache$)).toEqual({ '1': 'v1' });

      resource.invalidate({ id: '1' });

      expect(await firstValueFrom(resource.cache$)).toEqual({});

      await firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      expect(await firstValueFrom(resource.cache$)).toEqual({ '1': 'v2' });
    });

    it('should preserve other cache$ entries on invalidate', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(({ id }: { id: string }) => Promise.resolve(`${id}-v${++callCount}`));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ id: 'a' }));
      await firstValueFrom(resource.read$({ id: 'b' }));
      await flushPromises();

      resource.invalidate({ id: 'a' });

      expect(await firstValueFrom(resource.cache$)).toEqual({ b: 'b-v2' });
    });

    it('should accept partial params when key only uses a subset', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(`v${++callCount}`));

      const resource = createQueryResource<{ domain: string; hash: string }>({
        key: ({ domain }) => domain,
      })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { domain }) =>
            produce(cache, draft => {
              draft[domain] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ domain: 'app.dot', hash: '0xabc' }));
      await flushPromises();

      // Invalidate with only domain — hash not needed for key
      resource.invalidate({ domain: 'app.dot' });

      expect(await firstValueFrom(resource.cache$)).toEqual({});

      const result = await firstValueFrom(resource.read$({ domain: 'app.dot', hash: '0xabc' }));
      expect(result).toBe('v2');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateAll', () => {
    it('should force refetch for all keys', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => Promise.resolve(`v${++callCount}`));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ id: 'a' }));
      await firstValueFrom(resource.read$({ id: 'b' }));
      await flushPromises();

      expect(fn).toHaveBeenCalledTimes(2);

      resource.invalidateAll();

      await firstValueFrom(resource.read$({ id: 'a' }));
      await firstValueFrom(resource.read$({ id: 'b' }));

      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('aborts an in-flight request so the next read of the same key is not queued behind it', async () => {
      let callCount = 0;
      const fn = vi
        .fn()
        .mockImplementation(() => (++callCount === 1 ? new Promise<string>(() => {}) : Promise.resolve('recovered')));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .build();

      const hung = firstValueFrom(resource.read$({ id: '1' }));
      hung.catch(() => null);
      await flushPromises();
      expect(callCount).toBe(1);

      resource.invalidateAll();

      const second = firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      expect(callCount).toBe(2);
      await expect(second).resolves.toBe('recovered');
    });

    it('aborts every in-flight request of a key, not only the last one issued', async () => {
      let callCount = 0;
      const fn = vi
        .fn()
        .mockImplementation(() => (++callCount === 1 ? new Promise<string>(() => {}) : Promise.resolve('recovered')));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .build();

      // Two reads in one tick both miss the in-flight map and each issue a request;
      // the first hangs in the pool slot, the second queues behind it.
      const first = firstValueFrom(resource.read$({ id: '1' }));
      const second = firstValueFrom(resource.read$({ id: '1' }));
      first.catch(() => null);
      second.catch(() => null);
      await flushPromises();
      expect(callCount).toBe(1);

      resource.invalidateAll();

      const third = firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      expect(callCount).toBe(2);
      await expect(third).resolves.toBe('recovered');
    });

    it('should reset cache$ to initial', async () => {
      const fn = vi.fn().mockResolvedValue('v1');

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .cache<Record<string, string>>({
          initial: {},
          staleAfter: Number.POSITIVE_INFINITY,
          map: (cache, value, { id }) =>
            produce(cache, draft => {
              draft[id] = value;
            }),
        })
        .build();

      await firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      resource.invalidateAll();

      const cache = await firstValueFrom(resource.cache$);
      expect(cache).toEqual({});
    });
  });

  describe('timeout', () => {
    it('rejects the request when fn does not resolve within the timeout', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .timeout(20)
        .build();

      await expect(firstValueFrom(resource.read$({ id: '1' }))).rejects.toBeDefined();
    });

    it('rejects with a TimeoutError when fn hangs past the timeout', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .timeout(20)
        .build();

      await expect(firstValueFrom(resource.read$({ id: '1' }))).rejects.toMatchObject({ name: 'TimeoutError' });
    });

    it('does not abort fast-resolving requests', async () => {
      const fn = vi.fn().mockResolvedValue('ok');

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .timeout(1_000)
        .build();

      await expect(firstValueFrom(resource.read$({ id: '1' }))).resolves.toBe('ok');
    });

    it('frees the pool slot after a timeout so the next request can run', async () => {
      let resolveSecond: (v: string) => void = () => {};
      let callCount = 0;

      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return new Promise(() => {});
        return new Promise<string>(resolve => {
          resolveSecond = resolve;
        });
      });

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .timeout(20)
        .build();

      await expect(firstValueFrom(resource.read$({ id: '1' }))).rejects.toBeDefined();

      const second = firstValueFrom(resource.read$({ id: '1' }));
      await flushPromises();

      expect(callCount).toBe(2);
      resolveSecond('recovered');
      await expect(second).resolves.toBe('recovered');
    });

    it('does not apply a timeout when .timeout() is not configured', async () => {
      let resolveFn: (v: string) => void = () => {};
      const fn = vi.fn().mockImplementation(
        () =>
          new Promise<string>(resolve => {
            resolveFn = resolve;
          }),
      );

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .build();

      const pending = firstValueFrom(resource.read$({ id: '1' }));

      // Long enough that any accidental short timeout would fire.
      await new Promise(resolve => setTimeout(resolve, 50));

      resolveFn('done');
      await expect(pending).resolves.toBe('done');
    });

    it('threads the timeout through when a custom cache is configured', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));

      const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
        .request(fn)
        .timeout(20)
        .cache<Record<string, string>>({
          initial: {},
          map: (cache, value, { id }) => ({ ...cache, [id]: value }),
        })
        .build();

      await expect(firstValueFrom(resource.read$({ id: '1' }))).rejects.toMatchObject({ name: 'TimeoutError' });
    });
  });
});

describe('staleAfter as a function of the response', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

  const build = (fn: (params: { id: string }) => Promise<string | null>) =>
    createQueryResource<{ id: string }>({ key: ({ id }) => id })
      .request(fn)
      .cache<Record<string, string | null>>({
        initial: {},
        staleAfter: value => (value ? Number.POSITIVE_INFINITY : 30_000),
        map: (cache, value, { id }) => ({ ...cache, [id]: value }),
      })
      .build();

  it('keeps a value whose lifetime is infinite', async () => {
    const fn = vi.fn(async () => 'bytes');
    const resource = build(fn);

    await firstValueFrom(resource.read$({ id: '1' }));
    advance(60 * 60_000);
    await firstValueFrom(resource.read$({ id: '1' }));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('refetches a null only after its lifetime', async () => {
    const fn = vi.fn(async (): Promise<string | null> => null);
    const resource = build(fn);

    await firstValueFrom(resource.read$({ id: '1' }));
    await firstValueFrom(resource.read$({ id: '1' }));
    expect(fn).toHaveBeenCalledTimes(1);

    advance(29_999);
    await firstValueFrom(resource.read$({ id: '1' }));
    expect(fn).toHaveBeenCalledTimes(1);

    advance(2);
    await firstValueFrom(resource.read$({ id: '1' }));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache a rejection', async () => {
    const fn = vi.fn<(params: { id: string }) => Promise<string | null>>();
    fn.mockRejectedValueOnce(new Error('gateway down')).mockResolvedValue(null);
    const resource = build(fn);

    await expect(firstValueFrom(resource.read$({ id: '1' }))).rejects.toThrow('gateway down');
    await firstValueFrom(resource.read$({ id: '1' }));

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('keeps the numeric form unchanged', async () => {
    const fn = vi.fn(async () => 'x');
    const resource = createQueryResource<{ id: string }>({ key: ({ id }) => id })
      .request(fn)
      .cache({ initial: {}, staleAfter: 1_000, map: (cache, value, { id }) => ({ ...cache, [id]: value }) })
      .build();

    await firstValueFrom(resource.read$({ id: '1' }));
    await firstValueFrom(resource.read$({ id: '1' }));
    expect(fn).toHaveBeenCalledTimes(1);

    advance(1_001);
    await firstValueFrom(resource.read$({ id: '1' }));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
