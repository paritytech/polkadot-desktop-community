import { produce } from 'immer';
import { firstValueFrom } from 'rxjs';

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
