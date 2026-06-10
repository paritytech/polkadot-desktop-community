import { vi } from 'vitest';

type Listener = (event: unknown) => void;

// Real <div> base so React's reconciler can call setAttribute/style; webview-specific
// methods are vi.fn spies. Tests fire synthetic events via tag.dispatch(name, payload).
export function createMockWebviewTag() {
  const listeners = new Map<string, Set<Listener>>();
  const base = document.createElement('div');

  const tag = Object.assign(base, {
    loadURL: vi.fn<(url: string) => void>(),
    reload: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
    goBack: vi.fn<() => void>(),
    getWebContentsId: vi.fn<() => number>(() => 42),
    setZoomLevel: vi.fn<(level: number) => void>(),

    addEventListener: vi.fn((name: string, listener: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
    }),
    removeEventListener: vi.fn((name: string, listener: Listener) => {
      listeners.get(name)?.delete(listener);
    }),

    dispatch(name: string, payload: unknown) {
      for (const l of listeners.get(name) ?? []) l(payload);
    },

    listenerCount(name?: string) {
      if (name) return listeners.get(name)?.size ?? 0;
      return [...listeners.values()].reduce((acc, set) => acc + set.size, 0);
    },
  });

  return tag;
}

export type MockWebviewTag = ReturnType<typeof createMockWebviewTag>;
