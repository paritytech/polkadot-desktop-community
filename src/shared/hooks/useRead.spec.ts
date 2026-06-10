// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { EMPTY, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createQueryResource } from '@/shared/resource';

import { useRead } from './useRead';

describe('useRead', () => {
  it('stays idle when params is null', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useRead(fn, { params: null }));

    expect(fn).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('reads data from a function source', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.data).toBe('hello'));
    expect(result.current.pending).toBe(false);
  });

  it('re-reads when params change to a different key', async () => {
    const fn = vi.fn((p: { id: number }) => Promise.resolve(`v-${p.id}`));
    const { result, rerender } = renderHook(({ p }: { p: { id: number } }) => useRead(fn, { params: p }), {
      initialProps: { p: { id: 1 } },
    });
    await waitFor(() => expect(result.current.data).toBe('v-1'));

    rerender({ p: { id: 2 } });

    await waitFor(() => expect(result.current.data).toBe('v-2'));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('captures errors from the source', async () => {
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.error).toBe(err));
    expect(result.current.pending).toBe(false);
  });

  it('subscribes to an Observable factory and reflects each emission', () => {
    const subject = new Subject<number>();
    const { result } = renderHook(() => useRead(() => subject.asObservable(), { params: {} }));

    act(() => subject.next(1));
    expect(result.current.data).toBe(1);

    act(() => subject.next(2));
    expect(result.current.data).toBe(2);
  });

  it('aborts the AbortSignal on unmount', () => {
    let captured: AbortSignal | undefined;
    const fn = vi.fn((_p: unknown, signal?: AbortSignal) => {
      captured = signal;
      return new Promise<never>(() => {});
    });
    const { unmount } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    expect(captured?.aborted).toBe(false);
    unmount();
    expect(captured?.aborted).toBe(true);
  });

  it('refresh re-invokes the function', async () => {
    let calls = 0;
    const fn = vi.fn(() => Promise.resolve(++calls));
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('reads from a resource source', async () => {
    const fn = vi.fn().mockResolvedValue('from-resource');
    const resource = createQueryResource<{ id: number }>({ key: ({ id }) => id })
      .request(fn)
      .build();
    const { result } = renderHook(() => useRead(resource, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.data).toBe('from-resource'));
  });

  it('captures synchronous throw from function source', async () => {
    const err = new Error('sync');
    const fn = () => {
      throw err;
    };
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.error).toBe(err));
    expect(result.current.pending).toBe(false);
  });

  it('stays idle when params is undefined', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useRead(fn, { params: undefined }));

    expect(fn).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('resets to idle when params transition from value to null', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    type Props = { p: { id: number } | null };
    const initial: Props = { p: { id: 1 } };
    const { result, rerender } = renderHook(({ p }: Props) => useRead(fn, { params: p }), { initialProps: initial });
    await waitFor(() => expect(result.current.data).toBe('hello'));

    rerender({ p: null });

    await waitFor(() => expect(result.current.data).toBeUndefined());
    expect(result.current.pending).toBe(false);
  });

  it('fires when params transition from null to value', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    type Props = { p: { id: number } | null };
    const initial: Props = { p: null };
    const { result, rerender } = renderHook(({ p }: Props) => useRead(fn, { params: p }), { initialProps: initial });
    expect(fn).not.toHaveBeenCalled();

    rerender({ p: { id: 1 } });

    await waitFor(() => expect(result.current.data).toBe('hello'));
  });

  it('aborts previous AbortSignal when params change mid-flight', async () => {
    const signals: AbortSignal[] = [];
    const fn = vi.fn((p: { id: number }, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return new Promise<string>(resolve => setTimeout(() => resolve(`v-${p.id}`), 20));
    });
    const { result, rerender } = renderHook(({ p }: { p: { id: number } }) => useRead(fn, { params: p }), {
      initialProps: { p: { id: 1 } },
    });

    rerender({ p: { id: 2 } });

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await waitFor(() => expect(result.current.data).toBe('v-2'));
  });

  it('captures error from an Observable source', async () => {
    const err = new Error('stream broke');
    const subject = new Subject<number>();
    const { result } = renderHook(() => useRead(() => subject.asObservable(), { params: {} }));

    act(() => subject.error(err));

    await waitFor(() => expect(result.current.error).toBe(err));
    expect(result.current.pending).toBe(false);
  });

  it('captures error from resource read$', async () => {
    const err = new Error('resource boom');
    const fn = vi.fn().mockRejectedValue(err);
    const resource = createQueryResource<{ id: number }>({ key: ({ id }) => id })
      .request(fn)
      .build();
    const { result } = renderHook(() => useRead(resource, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.error).toBe(err));
  });

  it('refresh on resource source calls invalidate before re-reading', async () => {
    const fn = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const resource = createQueryResource<{ id: number }>({ key: ({ id }) => id })
      .request(fn)
      .cache<Record<string, string>>({
        initial: {},
        staleAfter: Number.POSITIVE_INFINITY,
        map: (cache, value, { id }) => ({ ...cache, [id]: value }),
      })
      .build();
    const invalidateSpy = vi.spyOn(resource, 'invalidate');
    const { result } = renderHook(() => useRead(resource, { params: { id: 1 } }));
    await waitFor(() => expect(result.current.data).toBe('v1'));

    act(() => result.current.refresh());

    expect(invalidateSpy).toHaveBeenCalledWith({ id: 1 });
    await waitFor(() => expect(result.current.data).toBe('v2'));
  });

  it('re-fires the source when remounted with the same params', async () => {
    const fn = vi.fn().mockResolvedValue('v');
    const params = { id: 1 };
    const first = renderHook(() => useRead(fn, { params }));
    await waitFor(() => expect(first.result.current.data).toBe('v'));
    first.unmount();

    const second = renderHook(() => useRead(fn, { params }));
    await waitFor(() => expect(second.result.current.data).toBe('v'));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns defaultValue until first emission', async () => {
    let resolver!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>(r => (resolver = r)));
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 }, defaultValue: 'initial' }));

    expect(result.current.data).toBe('initial');
    expect(result.current.pending).toBe(true);

    resolver('done');
    await waitFor(() => expect(result.current.data).toBe('done'));
  });

  it('projects from a resource cache via map', async () => {
    type Product = { baseName: string };
    const fn = vi.fn().mockResolvedValue({ baseName: 'x.dot' });
    const resource = createQueryResource<{ identifier: string }>({ key: ({ identifier }) => identifier })
      .request<Product>(fn)
      .cache<Record<string, Product>>({
        initial: {},
        staleAfter: Number.POSITIVE_INFINITY,
        map: (cache, value, { identifier }) => ({ ...cache, [identifier]: value }),
      })
      .build();
    const initial: Product | null = null;
    const { result } = renderHook(() =>
      useRead(resource, {
        params: { identifier: 'x.dot' },
        defaultValue: initial,
        map: (cache, { identifier }) => cache[identifier] ?? undefined,
      }),
    );

    await waitFor(() => expect(result.current.data).toEqual({ baseName: 'x.dot' }));
  });

  it('transforms each emission from a function source via map', async () => {
    const fn = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() =>
      useRead(fn, {
        params: { id: 1 },
        map: (value: string, { id }) => `${value}-${id}`,
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('hello-1'));
  });

  it('keeps defaultValue when map returns undefined', () => {
    type Product = { baseName: string };
    const fn = vi.fn().mockResolvedValue({ baseName: 'x.dot' });
    const resource = createQueryResource<{ identifier: string }>({ key: ({ identifier }) => identifier })
      .request<Product>(fn)
      .cache<Record<string, Product>>({
        initial: {},
        staleAfter: Number.POSITIVE_INFINITY,
        map: (cache, value, { identifier }) => ({ ...cache, [identifier]: value }),
      })
      .build();
    const fallback: string = 'fallback';
    const { result } = renderHook(() =>
      useRead(resource, {
        params: { identifier: 'not-cached.dot' },
        defaultValue: fallback,
        map: (cache, { identifier }) => (identifier in cache ? `found-${cache[identifier]?.baseName}` : undefined),
      }),
    );

    expect(result.current.data).toBe('fallback');
  });
}, 1000);

describe('useRead — in-flight dedup (function sources)', () => {
  it('collapses concurrent reads sharing fn + params into one invocation', async () => {
    const fn = vi.fn().mockResolvedValue('shared');
    const { result } = renderHook(() => ({
      a: useRead(fn, { params: { id: 1 } }),
      b: useRead(fn, { params: { id: 1 } }),
    }));

    await waitFor(() => {
      expect(result.current.a.data).toBe('shared');
      expect(result.current.b.data).toBe('shared');
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe across different request keys', async () => {
    const fn = vi.fn((p: { id: number }) => Promise.resolve(`v-${p.id}`));
    renderHook(() => {
      useRead(fn, { params: { id: 1 } });
      useRead(fn, { params: { id: 2 } });
    });

    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it('does not dedupe across different function references', async () => {
    const fnA = vi.fn().mockResolvedValue('a');
    const fnB = vi.fn().mockResolvedValue('b');
    renderHook(() => {
      useRead(fnA, { params: { id: 1 } });
      useRead(fnB, { params: { id: 1 } });
    });

    await waitFor(() => {
      expect(fnA).toHaveBeenCalledTimes(1);
      expect(fnB).toHaveBeenCalledTimes(1);
    });
  });

  it('aborts the shared request only when the last concurrent consumer leaves', () => {
    const signals: AbortSignal[] = [];
    const subject = new Subject<number>();
    const fn = vi.fn((_p: unknown, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return subject.asObservable();
    });
    const first = renderHook(() => useRead(fn, { params: { id: 1 } }));
    const second = renderHook(() => useRead(fn, { params: { id: 1 } }));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    first.unmount();
    expect(signals[0]?.aborted).toBe(false);

    second.unmount();
    expect(signals[0]?.aborted).toBe(true);
  });
}, 1000);

describe('useRead — pending lifecycle', () => {
  it('reports pending on the first render when params are present', () => {
    const fn = vi.fn(() => new Promise<string>(() => {})); // never settles
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    expect(result.current.pending).toBe(true);
  });

  it('clears pending when a function source resolves to undefined', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useRead(fn, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it('clears pending when an Observable source completes without emitting', async () => {
    const { result } = renderHook(() => useRead(() => EMPTY, { params: { id: 1 } }));

    await waitFor(() => expect(result.current.pending).toBe(false));
  });
});

describe('useRead — custom key', () => {
  it('dedupes by the custom key, ignoring volatile params the default serializer would split on', async () => {
    const fn = vi.fn().mockResolvedValue('x');
    renderHook(() => {
      useRead(fn, { params: { id: 1, volatile: 'a' }, key: p => String(p.id) });
      useRead(fn, { params: { id: 1, volatile: 'b' }, key: p => String(p.id) });
    });

    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
  });
});
