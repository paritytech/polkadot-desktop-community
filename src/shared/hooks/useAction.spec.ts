// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { err, errAsync, ok, okAsync } from 'neverthrow';
import { StrictMode } from 'react';
import { type Observable, EMPTY, Subject, firstValueFrom, lastValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { useAction } from './useAction';

describe('useAction', () => {
  it('starts idle and does not auto-fire', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useAction(fn));

    expect(fn).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('runs a Promise method and resolves with data', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useAction(fn));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({ id: 1 }))).resolves.toBe('done');
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('done');
    expect(fn).toHaveBeenCalledWith({ id: 1 });
  });

  it('captures rejection and re-throws from run', async () => {
    const err = new Error('nope');
    const fn = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useAction(fn));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).rejects.toBe(err);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(err);
  });

  it('updates data on each Observable emission and succeeds on complete', async () => {
    const subject = new Subject<string>();
    const { result } = renderHook(() => useAction(() => subject.asObservable()));

    let stream$!: Observable<string>;
    act(() => {
      stream$ = result.current.run({});
    });

    act(() => subject.next('step-1'));
    expect(result.current.data).toBe('step-1');

    act(() => subject.next('step-2'));
    await act(async () => {
      subject.complete();
      await lastValueFrom(stream$);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('step-2');
  });

  it('rejects when the Observable completes without emitting', async () => {
    const { result } = renderHook(() => useAction(() => EMPTY));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).rejects.toThrow();
    });

    expect(result.current.status).toBe('error');
  });

  it('reset returns the hook to idle', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useAction(fn));

    await act(async () => {
      await lastValueFrom(result.current.run({}));
    });
    expect(result.current.status).toBe('success');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });

  it('lets an in-flight action complete after unmount', async () => {
    let resolver!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>(r => (resolver = r)));

    let run!: (p: unknown) => Observable<string>;
    const { unmount } = renderHook(() => {
      const action = useAction(fn);
      run = action.run;
      return action;
    });

    let stream$!: Observable<string>;
    act(() => {
      stream$ = run({});
    });
    unmount();
    resolver('completed-after-unmount');

    await expect(firstValueFrom(stream$)).resolves.toBe('completed-after-unmount');
  });

  it('captures synchronous throw from method', async () => {
    const err = new Error('sync');
    const fn = () => {
      throw err;
    };
    const { result } = renderHook(() => useAction(fn));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).rejects.toBe(err);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(err);
  });

  it('uses the latest method passed to the hook', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');
    const { result, rerender } = renderHook(({ fn }: { fn: typeof first }) => useAction(fn), {
      initialProps: { fn: first },
    });

    rerender({ fn: second });

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).resolves.toBe('second');
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('captures Observable error after partial emissions and keeps the last value', async () => {
    const err = new Error('mid-stream');
    const subject = new Subject<string>();
    const { result } = renderHook(() => useAction(() => subject.asObservable()));

    let stream$!: Observable<string>;
    act(() => {
      stream$ = result.current.run({});
    });
    act(() => subject.next('partial'));

    await act(async () => {
      subject.error(err);
      await expect(lastValueFrom(stream$)).rejects.toBe(err);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.data).toBe('partial');
    expect(result.current.error).toBe(err);
  });

  it('handles concurrent runs and both observables resolve correctly', async () => {
    let resolveA!: (v: string) => void;
    let resolveB!: (v: string) => void;
    const fn = vi
      .fn<(p: { tag: string }) => Promise<string>>()
      .mockImplementationOnce(() => new Promise<string>(r => (resolveA = r)))
      .mockImplementationOnce(() => new Promise<string>(r => (resolveB = r)));
    const { result } = renderHook(() => useAction(fn));

    let streamA!: Observable<string>;
    let streamB!: Observable<string>;
    act(() => {
      streamA = result.current.run({ tag: 'a' });
      streamB = result.current.run({ tag: 'b' });
    });

    await act(async () => {
      resolveB('done-b');
      resolveA('done-a');
      await Promise.all([lastValueFrom(streamA), lastValueFrom(streamB)]);
    });

    await expect(lastValueFrom(streamA)).resolves.toBe('done-a');
    await expect(lastValueFrom(streamB)).resolves.toBe('done-b');
  });

  it('documents that reset before completion is overwritten when the in-flight settles', async () => {
    let resolver!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>(r => (resolver = r)));
    const { result } = renderHook(() => useAction(fn));

    let stream$!: Observable<string>;
    act(() => {
      stream$ = result.current.run({});
    });
    expect(result.current.status).toBe('pending');

    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      resolver('done');
      await lastValueFrom(stream$);
    });

    // KNOWN: reset does not cancel an in-flight action. When it settles, its
    // setState wins and status transitions idle → success.
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('done');
  });

  it('unwraps a synchronous Ok Result into data', async () => {
    const { result } = renderHook(() => useAction(() => ok('value')));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).resolves.toBe('value');
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('value');
  });

  it('routes a synchronous Err Result into error and rejects run', async () => {
    const failure = new Error('boom');
    const { result } = renderHook(() => useAction(() => err(failure)));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).rejects.toBe(failure);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(failure);
  });

  it('unwraps a ResultAsync Ok into data', async () => {
    const { result } = renderHook(() => useAction(() => okAsync(42)));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).resolves.toBe(42);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe(42);
  });

  it('routes a ResultAsync Err into error and rejects run', async () => {
    const failure = new Error('async-boom');
    const { result } = renderHook(() => useAction(() => errAsync(failure)));

    await act(async () => {
      await expect(lastValueFrom(result.current.run({}))).rejects.toBe(failure);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(failure);
  });

  it('still updates state after the effect re-mounts (StrictMode regression)', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useAction(fn), { wrapper: StrictMode });

    await act(async () => {
      await lastValueFrom(result.current.run({}));
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('done');
  });
});
