// @vitest-environment happy-dom

import { act, cleanup, render } from '@testing-library/react';
import React from 'react';
import { type PropsWithChildren } from 'react';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type HexString } from '@/shared/types';
import type * as productDomain from '@/domains/product';
import { EXECUTABLE_KINDS } from '@/domains/product';
import { type WebviewCrashInfo, type WebviewHealthEntry, type WebviewUnresponsiveInfo } from '@/aggregates/webview-registry';
// eslint-disable-next-line local-rules/no-relative-import-from-root -- cross-target drift guard: pin the renderer's partition string to the main-process builder
import { buildSandboxPartition } from '../../../main/sandbox/lib';

const TEST_HASH: HexString = '0xdeadbeef';

import { Webview } from './Webview';
import { type MockWebviewTag, createMockWebviewTag } from './__tests__/MockWebviewTag';

const {
  useExecutableArchiveMock,
  useResolveProductMock,
  useSessionMock,
  containerDispose,
  createContainerMock,
  productLoadingSet,
  registryRegister,
  registryUnregister,
  registryClearCrash,
  registryClearUnresponsive,
  registryClearHealth,
  useWebviewCrashMock,
  useWebviewUnresponsiveMock,
  useWebviewHealthMock,
} = vi.hoisted(() => {
  const containerDispose = vi.fn();
  return {
    useExecutableArchiveMock: vi.fn(),
    useResolveProductMock: vi.fn(),
    useSessionMock: vi.fn(() => ({ session: 'session-A' })),
    containerDispose,
    createContainerMock: vi.fn(() => ({ dispose: containerDispose })),
    productLoadingSet: vi.fn(),
    registryRegister: vi.fn(),
    registryUnregister: vi.fn(),
    registryClearCrash: vi.fn(),
    registryClearUnresponsive: vi.fn(),
    registryClearHealth: vi.fn(),

    useWebviewCrashMock: vi.fn<() => WebviewCrashInfo | null>(() => null),
    useWebviewUnresponsiveMock: vi.fn<() => WebviewUnresponsiveInfo | null>(() => null),
    useWebviewHealthMock: vi.fn<() => WebviewHealthEntry | null>(() => null),
  };
});

vi.mock('@/domains/product', async importOriginal => {
  const real = await importOriginal<typeof productDomain>();
  return {
    ...real,
    useExecutableArchive: (...args: unknown[]) => useExecutableArchiveMock(...args),
    useDisplayedProduct: (...args: unknown[]) => useResolveProductMock(...args),
  };
});

vi.mock('@novasamatech/host-papp-react-ui', () => ({ useSession: () => useSessionMock() }));

vi.mock('@novasamatech/tr-ui', () => ({
  toastError: vi.fn(),
  useTheme: () => ({ mode: 'light' }),
  Button: ({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@novasamatech/host-container', () => ({
  createContainer: (provider: unknown) => (createContainerMock as (p: unknown) => unknown)(provider),
  createWebviewProvider: vi.fn(),
}));

vi.mock('@/aggregates/product-loading', () => ({
  productLoading: { set: (...a: unknown[]) => productLoadingSet(...a) },
}));

vi.mock('@/aggregates/webview-registry', () => ({
  webviewRegistry: {
    register: registryRegister,
    unregister: registryUnregister,
    clearCrash: registryClearCrash,
    clearUnresponsive: registryClearUnresponsive,
    clearHealth: registryClearHealth,
  },
  useWebviewCrash: () => useWebviewCrashMock(),
  useWebviewUnresponsive: () => useWebviewUnresponsiveMock(),
  useWebviewHealth: () => useWebviewHealthMock(),
}));

vi.mock('@/widgets/ProductContainerBinding', () => ({ ProductContainerBinding: () => null }));

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

let mockTag: MockWebviewTag;
let createElementSpy: ReturnType<typeof vi.spyOn>;

function resolvedArchive(origin: string) {
  return { contenthash: 'hash', archive: { domain: origin.replace('polkadot://', ''), origin, files: {} } };
}

const productFixture = {
  baseName: 'app.dot',
  displayName: 'App',
  description: '',
  icon: { cid: '', format: 'png' },
  executables: { app: { kind: 'app', identifier: 'app.dot', appVersion: [0, 0, 0], contenthash: TEST_HASH } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTag = createMockWebviewTag();
  useExecutableArchiveMock.mockReturnValue({ data: null, pending: false, error: null });
  useResolveProductMock.mockReturnValue({ data: productFixture, pending: false, error: null });
  // Replace document.createElement('webview') so React's reconciler installs our mock.
  const realCreateElement = document.createElement.bind(document);
  createElementSpy = vi
    .spyOn(document, 'createElement')

    .mockImplementation(((name: string, options?: ElementCreationOptions) => {
      if (name === 'webview') return mockTag as unknown as HTMLElement;
      return realCreateElement(name, options);
    }) as typeof document.createElement) as ReturnType<typeof vi.spyOn>;
});

afterEach(() => {
  cleanup();
  createElementSpy?.mockRestore();
});

function localhostMounted() {
  useExecutableArchiveMock.mockReturnValue({ data: null, pending: false, error: null });
  return render(
    <Providers>
      <Webview kind="app" identifier="http://localhost:5173" visible={true} />
    </Providers>,
  );
}

describe('Webview — lifecycle', () => {
  it('sets productLoading=true on mount and =false on unmount', () => {
    const { unmount } = localhostMounted();
    expect(productLoadingSet).toHaveBeenCalledWith('http://localhost:5173', true);
    productLoadingSet.mockClear();
    unmount();
    expect(productLoadingSet).toHaveBeenCalledWith('http://localhost:5173', false);
  });

  it('registers webContentsId on dom-ready and unregisters on unmount', () => {
    const { unmount } = localhostMounted();
    act(() => mockTag.dispatch('dom-ready', {}));
    expect(registryRegister).toHaveBeenCalledWith('http://localhost:5173', 42);
    unmount();
    expect(registryUnregister).toHaveBeenCalledWith('http://localhost:5173');
  });

  it('clears productLoading + webviewLoading on did-finish-load', () => {
    localhostMounted();
    productLoadingSet.mockClear();
    act(() => mockTag.dispatch('did-finish-load', {}));
    expect(productLoadingSet).toHaveBeenCalledWith('http://localhost:5173', false);
  });

  it('disposes the container on unmount', () => {
    const { unmount } = localhostMounted();
    expect(createContainerMock).toHaveBeenCalled();
    unmount();
    expect(containerDispose).toHaveBeenCalled();
  });

  it('sets productLoading=false when executable resolution fails', () => {
    useExecutableArchiveMock.mockReturnValue({ data: null, pending: false, error: new Error('dns') });
    render(
      <Providers>
        <Webview kind="app" identifier="app.dot" visible={true} />
      </Providers>,
    );
    expect(productLoadingSet).toHaveBeenCalledWith('app.dot', false);
  });
});

describe('Webview — src derivation and reload', () => {
  it('derives src from normalizeLocalhostUrl for localhost identifier', () => {
    const { container } = localhostMounted();
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.getAttribute('src')).toMatch(/^http:\/\/localhost/);
  });

  it('derives src from archive.origin for resolved .dot identifier', () => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.app.dot'), pending: false, error: null });
    const { container } = render(<Webview kind="app" identifier="app.dot" pathname="/x" visible={true} />, {
      wrapper: Providers,
    });
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.getAttribute('src')).toBe('polkadot://app.app.dot/x');
  });

  it('does not update src when pathname matches lastWebviewPathnameRef', () => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    const { container, rerender } = render(<Webview kind="app" identifier="app.dot" pathname="a" visible={true} />, {
      wrapper: Providers,
    });
    const initialSrc = container.querySelector('[data-testid="webview-host"]')?.getAttribute('src');
    // Synthesize a navigation-in-page event so lastWebviewPathnameRef updates to 'b'.
    act(() => mockTag.dispatch('did-navigate-in-page', { url: 'polkadot://app.dot/b', isMainFrame: true }));
    rerender(<Webview kind="app" identifier="app.dot" pathname="b" visible={true} />);
    const finalSrc = container.querySelector('[data-testid="webview-host"]')?.getAttribute('src');
    // lastWebviewPathnameRef now holds 'b', matching the pathname prop 'b'.
    // The guard in the src-derivation effect fires correctly — src does NOT update.
    expect(finalSrc).toBe(initialSrc);
  });

  it('triggers webviewRef.reload() when session changes while ready', () => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    // Use a wrapper that can force re-renders of the memoized Webview via its own state.
    // memo() only skips re-renders when triggered by a parent re-render with unchanged props;
    // changing the session mock alone doesn't cause React to re-render the component.
    // We trigger re-render by adding an invisible but changing `onPathnameChange` callback.
    const { rerender } = render(<Webview kind="app" identifier="app.dot" visible={true} onPathnameChange={() => {}} />, {
      wrapper: Providers,
    });
    expect(mockTag.reload).not.toHaveBeenCalled();
    useSessionMock.mockReturnValue({ session: 'session-B' });
    rerender(<Webview kind="app" identifier="app.dot" visible={true} onPathnameChange={() => {}} />);
    expect(mockTag.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when session changes while not ready', () => {
    useExecutableArchiveMock.mockReturnValue({ data: null, pending: true, error: null });
    const { rerender } = render(<Webview kind="app" identifier="app.dot" visible={true} />, { wrapper: Providers });
    useSessionMock.mockReturnValue({ session: 'session-B' });
    rerender(<Webview kind="app" identifier="app.dot" visible={true} />);
    expect(mockTag.reload).not.toHaveBeenCalled();
  });

  it('reloadTrigger$ emits → loadURL(src) called', () => {
    const reload$ = new Subject<void>();
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    render(<Webview kind="app" identifier="app.dot" reloadTrigger$={reload$} visible={true} />, { wrapper: Providers });
    act(() => reload$.next());
    expect(mockTag.loadURL).toHaveBeenCalledWith('polkadot://app.dot/');
  });

  it('reloadTrigger$ unsubscribes on unmount', () => {
    const reload$ = new Subject<void>();
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    const { unmount } = render(<Webview kind="app" identifier="app.dot" reloadTrigger$={reload$} visible={true} />, {
      wrapper: Providers,
    });
    unmount();
    expect(reload$.observed).toBe(false);
  });
});

describe('Webview — navigation dispatcher integration', () => {
  function dotMounted(props: { onCrossProductLink?: (t: unknown) => void; onPathnameChange?: (p: string) => void } = {}) {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    return render(<Webview kind="app" identifier="app.dot" visible={true} {...props} />, { wrapper: Providers });
  }

  it('preventDefault + stop + emit on cross-product will-navigate', () => {
    const onCross = vi.fn();
    dotMounted({ onCrossProductLink: onCross });
    const e = { url: 'polkadot://other.dot/x', preventDefault: vi.fn() };
    act(() => mockTag.dispatch('will-navigate', e));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(mockTag.stop).toHaveBeenCalled();
    expect(onCross).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'other.dot' }));
  });

  it('emits onPathnameChange on same-product polkadot will-navigate (no preventDefault)', () => {
    const onPath = vi.fn();
    dotMounted({ onPathnameChange: onPath });
    const e = { url: 'polkadot://app.dot/sub', preventDefault: vi.fn() };
    act(() => mockTag.dispatch('will-navigate', e));
    expect(onPath).toHaveBeenCalledWith('sub');
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('did-navigate fallback calls loadURL(desired) on race-loss', () => {
    dotMounted();
    act(() => mockTag.dispatch('did-navigate', { url: 'polkadot://other.dot/x' }));
    expect(mockTag.loadURL).toHaveBeenCalledWith('polkadot://app.dot/');
  });

  it('did-navigate-in-page emits pathname change for same-product', () => {
    const onPath = vi.fn();
    dotMounted({ onPathnameChange: onPath });
    act(() => mockTag.dispatch('did-navigate-in-page', { url: 'polkadot://app.dot/spa', isMainFrame: true }));
    expect(onPath).toHaveBeenCalledWith('spa');
  });
});

describe('Webview — console-message routing', () => {
  it('attaches console-message listener for localhost identifier', () => {
    localhostMounted();
    expect(mockTag.addEventListener.mock.calls.some(c => c[0] === 'console-message')).toBe(true);
  });

  it('attaches console-message listener for .dot identifier', () => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://app.dot'), pending: false, error: null });
    render(<Webview kind="app" identifier="app.dot" visible={true} />, { wrapper: Providers });
    expect(mockTag.addEventListener.mock.calls.some(c => c[0] === 'console-message')).toBe(true);
  });

  it('does NOT attach console-message listener for non-dot, non-localhost identifier', () => {
    useExecutableArchiveMock.mockReturnValue({
      data: resolvedArchive('polkadot://something.weird'),
      pending: false,
      error: null,
    });
    render(<Webview kind="app" identifier="not-a-dot-identifier" visible={true} />, { wrapper: Providers });
    expect(mockTag.addEventListener.mock.calls.some(c => c[0] === 'console-message')).toBe(false);
  });

  it('routes levels 0/1/2/3 to console.debug/info/warn/error and unknown to info', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    localhostMounted();
    // Filter out the component's own state-transition / event logs (prefixed with `[Webview:`)
    // — only count the console-message routing calls.
    const isStateLog = (call: unknown[]) => typeof call[0] === 'string' && call[0].startsWith('[Webview:');
    debug.mockClear();
    info.mockClear();
    warn.mockClear();
    error.mockClear();
    for (const level of [0, 1, 2, 3, 99]) {
      act(() => mockTag.dispatch('console-message', { level, message: 'm' }));
    }
    const consoleMessageDebug = debug.mock.calls.filter(c => !isStateLog(c));
    const consoleMessageInfo = info.mock.calls.filter(c => !isStateLog(c));
    const consoleMessageWarn = warn.mock.calls.filter(c => !isStateLog(c));
    const consoleMessageError = error.mock.calls.filter(c => !isStateLog(c));
    expect(consoleMessageDebug).toHaveLength(1); // level 0
    expect(consoleMessageInfo).toHaveLength(2); // level 1 + fallback (level 99)
    expect(consoleMessageWarn).toHaveLength(1);
    expect(consoleMessageError).toHaveLength(1);
    debug.mockRestore();
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('Webview — crash overlay', () => {
  const fakeCrash = { webContentsId: 7, url: 'polkadot://app.dot/', reason: 'oom', exitCode: 5, at: 1700000000000 };

  it('shows CrashOverlay when useWebviewCrash returns a crash', () => {
    useWebviewCrashMock.mockReturnValue(fakeCrash);
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="crash-overlay-reload"]')).not.toBeNull();
  });

  it('does not show CrashOverlay when there is no crash', () => {
    useWebviewCrashMock.mockReturnValue(null);
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="crash-overlay-reload"]')).toBeNull();
  });

  it('calls clearCrash and webview.reload on Reload click', () => {
    useWebviewCrashMock.mockReturnValue(fakeCrash);
    const { container } = localhostMounted();
    act(() => mockTag.dispatch('dom-ready', {}));
    const btn = container.querySelector('[data-testid="crash-overlay-reload"]');
    act(() => (btn as HTMLElement).click());
    expect(registryClearCrash).toHaveBeenCalledWith(7);
    expect(mockTag.reload).toHaveBeenCalled();
  });
});

describe('Webview — unresponsive overlay', () => {
  const fakeUnresponsive = { webContentsId: 11, url: 'polkadot://app.dot/', at: 1700000000000 };

  // beforeEach only clears call history; mockReturnValue from earlier suites persists,
  // so we restore the default no-crash/no-unresponsive baseline explicitly.
  beforeEach(() => {
    useWebviewCrashMock.mockReturnValue(null);
    useWebviewUnresponsiveMock.mockReturnValue(null);
  });

  it('shows UnresponsiveOverlay and applies blur+grayscale to the webview', () => {
    useWebviewUnresponsiveMock.mockReturnValue(fakeUnresponsive);
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="unresponsive-overlay-reload"]')).not.toBeNull();
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.className).toMatch(/blur-sm/);
    expect(tag?.className).toMatch(/grayscale/);
  });

  it('does not show UnresponsiveOverlay when there is no unresponsive entry', () => {
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="unresponsive-overlay-reload"]')).toBeNull();
  });

  it('crash overlay takes precedence and the webview is not double-styled', () => {
    useWebviewCrashMock.mockReturnValue({
      webContentsId: 11,
      url: 'polkadot://app.dot/',
      reason: 'oom',
      exitCode: 5,
      at: 1700000000000,
    });
    useWebviewUnresponsiveMock.mockReturnValue(fakeUnresponsive);
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="crash-overlay-reload"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="unresponsive-overlay-reload"]')).toBeNull();
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.className).not.toMatch(/blur-sm/);
  });

  it('reload click clears unresponsive state and reloads the webview', () => {
    useWebviewUnresponsiveMock.mockReturnValue(fakeUnresponsive);
    const { container } = localhostMounted();
    act(() => mockTag.dispatch('dom-ready', {}));
    const btn = container.querySelector('[data-testid="unresponsive-overlay-reload"]');
    act(() => (btn as HTMLElement).click());
    expect(registryClearUnresponsive).toHaveBeenCalledWith(11);
    expect(mockTag.reload).toHaveBeenCalled();
  });
});

describe('Webview — degraded banner', () => {
  beforeEach(() => {
    useWebviewCrashMock.mockReturnValue(null);
    useWebviewUnresponsiveMock.mockReturnValue(null);
    useWebviewHealthMock.mockReturnValue(null);
  });

  it('shows DegradedBanner when useWebviewHealth returns a degraded entry', () => {
    useWebviewHealthMock.mockReturnValue({
      webContentsId: 42,
      productId: 'p1',
      state: 'degraded',
      reason: { kind: 'heartbeat-rtt-high' },
      since: Date.now(),
    });
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="degraded-banner-reload"]')).not.toBeNull();
  });

  it('does not show DegradedBanner when CrashOverlay is showing', () => {
    useWebviewCrashMock.mockReturnValue({
      webContentsId: 42,
      url: 'about:blank',
      reason: 'crashed',
      exitCode: 0,
      at: Date.now(),
    });
    useWebviewHealthMock.mockReturnValue({
      webContentsId: 42,
      productId: 'p1',
      state: 'degraded',
      reason: { kind: 'heartbeat-rtt-high' },
      since: Date.now(),
    });
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="degraded-banner"]')).toBeNull();
  });

  it('does not show DegradedBanner when UnresponsiveOverlay is showing', () => {
    useWebviewUnresponsiveMock.mockReturnValue({
      webContentsId: 42,
      url: 'about:blank',
      at: Date.now(),
    });
    useWebviewHealthMock.mockReturnValue({
      webContentsId: 42,
      productId: 'p1',
      state: 'degraded',
      reason: { kind: 'heartbeat-rtt-high' },
      since: Date.now(),
    });
    const { container } = localhostMounted();
    expect(container.querySelector('[data-testid="degraded-banner"]')).toBeNull();
  });

  it('reload click clears health entry and reloads webview', () => {
    useWebviewHealthMock.mockReturnValue({
      webContentsId: 42,
      productId: 'p1',
      state: 'degraded',
      reason: { kind: 'heartbeat-rtt-high' },
      since: Date.now(),
    });
    const { container } = localhostMounted();
    act(() => mockTag.dispatch('dom-ready', {}));
    const btn = container.querySelector('[data-testid="degraded-banner-reload"]') as HTMLButtonElement;
    act(() => (btn as HTMLElement).click());
    expect(registryClearHealth).toHaveBeenCalledWith(42);
    expect(mockTag.reload).toHaveBeenCalled();
  });
});

describe('Webview — visibility beacon', () => {
  let sendWebviewVisibility: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendWebviewVisibility = vi.fn();
    // @ts-expect-error stub
    globalThis.window.App = { sendWebviewVisibility };
  });

  afterEach(() => {
    // @ts-expect-error stub
    delete globalThis.window.App;
  });

  it('does not send visible=true beacon when visible prop is false', () => {
    render(
      <Providers>
        <Webview kind="app" identifier="http://localhost:5173" visible={false} />
      </Providers>,
    );
    act(() => mockTag.dispatch('dom-ready', {}));
    const calls = sendWebviewVisibility.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([, v]) => v === false)).toBe(true);
  });

  it('sends visible=true beacon when visible prop is true (default)', () => {
    render(
      <Providers>
        <Webview kind="app" identifier="http://localhost:5173" visible={true} />
      </Providers>,
    );
    act(() => mockTag.dispatch('dom-ready', {}));
    const calls = sendWebviewVisibility.mock.calls;
    expect(calls.some(([, v]) => v === true)).toBe(true);
  });
});

describe('Webview — partition encoding', () => {
  it('partition is sandbox-app-<encoded id>', () => {
    const { container } = localhostMounted();
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.getAttribute('partition')).toBe(`sandbox-app-${encodeURIComponent('http://localhost:5173')}`);
  });

  it('partition is path-traversal safe (encodes slashes)', () => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://x'), pending: false, error: null });
    const { container } = render(<Webview kind="app" identifier="foo/bar" visible={true} />, { wrapper: Providers });
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.getAttribute('partition')).toBe('sandbox-app-foo%2Fbar');
  });

  // The renderer cannot import main/ code in production, so Webview hand-builds the
  // partition string. This pins it to the main-process builder for EVERY executable
  // kind — iterating EXECUTABLE_KINDS means a newly added kind is covered automatically
  // and fails the guard the moment the two sides drift.
  it.each(EXECUTABLE_KINDS)('%s partition matches the main-process builder (cross-target drift guard)', kind => {
    useExecutableArchiveMock.mockReturnValue({ data: resolvedArchive('polkadot://x'), pending: false, error: null });
    const { container } = render(<Webview kind={kind} identifier="foo.dot" visible={true} />, { wrapper: Providers });
    const tag = container.querySelector('[data-testid="webview-host"]');
    expect(tag?.getAttribute('partition')).toBe(buildSandboxPartition('foo.dot', kind));
  });
});
