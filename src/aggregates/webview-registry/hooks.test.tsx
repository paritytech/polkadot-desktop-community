// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useWebviewCrash } from './hooks';
import { webviewRegistry } from './state/registry';

beforeEach(() => {
  for (const id of Object.keys(webviewRegistry.ids$.get())) webviewRegistry.unregister(id);
  for (const wcid of Object.keys(webviewRegistry.crashes$.get())) webviewRegistry.clearCrash(Number(wcid));
});

describe('useWebviewCrash', () => {
  it('returns null when the identifier is unknown', () => {
    const { result } = renderHook(() => useWebviewCrash('app.dot'));
    expect(result.current).toBeNull();
  });

  it('returns null when the identifier is registered but has no crash', () => {
    act(() => webviewRegistry.register('app.dot', 1));
    const { result } = renderHook(() => useWebviewCrash('app.dot'));
    expect(result.current).toBeNull();
  });

  it('returns crash info when the registered webContentsId has crashed', () => {
    act(() => {
      webviewRegistry.register('app.dot', 1);
      webviewRegistry.markCrashed({ webContentsId: 1, url: 'polkadot://app.dot/', reason: 'oom', exitCode: 5, at: 42 });
    });
    const { result } = renderHook(() => useWebviewCrash('app.dot'));
    expect(result.current).toEqual({ webContentsId: 1, url: 'polkadot://app.dot/', reason: 'oom', exitCode: 5, at: 42 });
  });

  it('updates reactively when crash arrives after hook mounts', () => {
    act(() => webviewRegistry.register('app.dot', 1));
    const { result } = renderHook(() => useWebviewCrash('app.dot'));
    expect(result.current).toBeNull();
    act(() =>
      webviewRegistry.markCrashed({ webContentsId: 1, url: 'polkadot://app.dot/', reason: 'crashed', exitCode: 1, at: 1 }),
    );
    expect(result.current?.reason).toBe('crashed');
  });

  it('flips back to null after a fresh register clears the crash', () => {
    act(() => {
      webviewRegistry.register('app.dot', 1);
      webviewRegistry.markCrashed({ webContentsId: 1, url: 'a', reason: 'oom', exitCode: 5, at: 1 });
    });
    const { result } = renderHook(() => useWebviewCrash('app.dot'));
    expect(result.current).not.toBeNull();
    act(() => webviewRegistry.register('app.dot', 2));
    expect(result.current).toBeNull();
  });

  it('does not return a crash for a different identifier', () => {
    act(() => {
      webviewRegistry.register('a.dot', 1);
      webviewRegistry.register('b.dot', 2);
      webviewRegistry.markCrashed({ webContentsId: 2, url: 'b', reason: 'killed', exitCode: 9, at: 1 });
    });
    const { result } = renderHook(() => useWebviewCrash('a.dot'));
    expect(result.current).toBeNull();
  });
});
