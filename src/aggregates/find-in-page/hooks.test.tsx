// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { type WebviewTag } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFindInPageExecutor } from './hooks';
import { findInPage } from './state/sessions';

const TAB = 'app.dot';

// Explicit subset of WebviewTag the executor touches. Naming the surface here
// keeps the fake honest: when the real API drifts, type errors point at the
// shim, not a silent runtime mismatch behind a bare `as unknown as WebviewTag`.
type WebviewFake = Pick<WebviewTag, 'findInPage' | 'stopFindInPage' | 'addEventListener' | 'removeEventListener'>;

// Minimal fake of WebviewFake. Captures registered listeners so tests can emit
// native events synchronously.
function createFakeWebview() {
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const fake: WebviewFake = {
    findInPage: vi.fn(),
    stopFindInPage: vi.fn(),
    addEventListener: ((type: string, handler: (event: unknown) => void) => {
      (listeners[type] ??= []).push(handler);
    }) as WebviewFake['addEventListener'],
    removeEventListener: ((type: string, handler: (event: unknown) => void) => {
      listeners[type] = (listeners[type] ?? []).filter(h => h !== handler);
    }) as WebviewFake['removeEventListener'],
  };
  const emit = (type: string, event: unknown) => {
    for (const handler of listeners[type] ?? []) handler(event);
  };

  // The executor accepts WebviewTag; only the WebviewFake subset is actually
  // exercised, so the upcast is documented here once.

  return { webview: fake as unknown as WebviewTag, emit, listeners };
}

beforeEach(() => {
  for (const id of Object.keys(findInPage.sessions$.get())) findInPage.clear(id);
});

describe('useFindInPageExecutor', () => {
  it('calls findInPage when a search is dispatched', () => {
    const { webview } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.setQuery(TAB, 'hello'));
    expect(webview.findInPage).toHaveBeenCalledWith('hello');
  });

  it('passes direction options for next/prev', () => {
    const { webview } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.open(TAB));
    act(() => findInPage.setQuery(TAB, 'hello'));
    act(() => findInPage.stepNext(TAB));
    expect(webview.findInPage).toHaveBeenLastCalledWith('hello', { findNext: true, forward: true });
    act(() => findInPage.stepPrev(TAB));
    expect(webview.findInPage).toHaveBeenLastCalledWith('hello', { findNext: true, forward: false });
  });

  it('stops the native find on close', () => {
    const { webview } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.setQuery(TAB, 'hello'));
    act(() => findInPage.close(TAB));
    expect(webview.stopFindInPage).toHaveBeenCalledWith('clearSelection');
  });

  it('reports match counts from the found-in-page event', () => {
    const { webview, emit } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.setQuery(TAB, 'hello'));
    act(() => emit('found-in-page', { result: { matches: 12, activeMatchOrdinal: 3 } }));
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ matches: 12, activeMatchOrdinal: 3 });
  });

  it('re-runs the active search after a full load/reload', () => {
    const { webview, emit } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.open(TAB));
    act(() => findInPage.setQuery(TAB, 'hello'));
    act(() => emit('found-in-page', { result: { matches: 12, activeMatchOrdinal: 3 } }));
    vi.mocked(webview.findInPage).mockClear();
    act(() => emit('did-finish-load', {}));
    // Counts reset and the search is re-issued against the freshly loaded content.
    expect(findInPage.sessions$.get()[TAB]).toMatchObject({ matches: 0, activeMatchOrdinal: 0 });
    expect(webview.findInPage).toHaveBeenCalledWith('hello');
  });

  it('re-runs the active search on SPA in-page navigation', () => {
    const { webview, emit } = createFakeWebview();
    renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.open(TAB));
    act(() => findInPage.setQuery(TAB, 'hello'));
    vi.mocked(webview.findInPage).mockClear();
    act(() => emit('did-navigate-in-page', {}));
    expect(webview.findInPage).toHaveBeenCalledWith('hello');
  });

  it('clears the session on unmount', () => {
    const { webview } = createFakeWebview();
    const { unmount } = renderHook(() => useFindInPageExecutor(TAB, webview));

    act(() => findInPage.setQuery(TAB, 'hello'));
    unmount();
    expect(findInPage.sessions$.get()[TAB]).toBeUndefined();
  });

  it('detaches native listeners on unmount', () => {
    const { webview, listeners } = createFakeWebview();
    const { unmount } = renderHook(() => useFindInPageExecutor(TAB, webview));
    unmount();
    expect(listeners['found-in-page'] ?? []).toHaveLength(0);
    expect(listeners['did-finish-load'] ?? []).toHaveLength(0);
    expect(listeners['did-navigate-in-page'] ?? []).toHaveLength(0);
  });
});
