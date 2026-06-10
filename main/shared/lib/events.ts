import { type WebContents, ipcMain, ipcRenderer } from 'electron';
import { nanoid } from 'nanoid';

function requestKey(key: string) {
  return `${key}:request`;
}
function responseKey(key: string) {
  return `${key}:response`;
}

type Message<T> = {
  requestId: string;
  value: T;
};

export function createBridgeRequest<Params, Return>(key: string, handler: (value: Params) => Promise<Return>) {
  const callback = async (_: unknown, { requestId, value }: Message<Params>) => {
    const response = await handler(value);
    ipcRenderer.send(responseKey(key), { requestId, value: response } satisfies Message<Return>);
  };

  ipcRenderer.addListener(requestKey(key), callback);
  return () => {
    ipcRenderer.removeListener(requestKey(key), callback);
  };
}

export function createPreloadRequestHandler<Params, Return>(key: string) {
  return (handler: (value: Params) => Promise<Return>) => createBridgeRequest(key, handler);
}

// Upper bound on a single createMainRequest. The renderer should normally
// answer in milliseconds; anything past this is the renderer being wedged
// (frozen worker, dead chain follow, etc.) and the caller deserves a failure
// instead of a forever-pending promise.
const REQUEST_TIMEOUT_MS = 60_000;

type PendingEntry = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

// One ipcMain listener per key, multiplexed across concurrent requests by
// requestId. Prevents MaxListenersExceeded when a busy page fires many
// concurrent requests for the same key (e.g. remotePermission per asset).
const pendingByKey = new Map<string, Map<string, PendingEntry>>();

function pendingForKey(key: string): Map<string, PendingEntry> {
  const existing = pendingByKey.get(key);
  if (existing) return existing;

  const pending = new Map<string, PendingEntry>();
  pendingByKey.set(key, pending);

  ipcMain.addListener(responseKey(key), (_: unknown, response: Message<unknown>) => {
    const entry = pending.get(response.requestId);
    if (!entry) return;
    pending.delete(response.requestId);
    entry.resolve(response.value);
  });

  return pending;
}

// Per-webContents tracking so we can reject every in-flight request when the
// renderer goes away (destroyed, crashed, reloaded). Without this, a renderer
// reload after wake-crash recovery leaks resolvers forever and any caller
// awaiting them hangs.
type Tracker = { pending: Set<PendingEntry> };
const trackerByWebContents = new WeakMap<WebContents, Tracker>();

function getTracker(webContents: WebContents): Tracker {
  const existing = trackerByWebContents.get(webContents);
  if (existing) return existing;

  const pending = new Set<PendingEntry>();

  const rejectAll = (reason: string) => {
    if (pending.size === 0) return;
    const snapshot = [...pending];
    pending.clear();
    const error = new Error(reason);
    for (const entry of snapshot) entry.reject(error);
  };

  webContents.once('destroyed', () => {
    rejectAll('createMainRequest aborted: webContents destroyed');
    trackerByWebContents.delete(webContents);
  });
  webContents.on('render-process-gone', () => {
    rejectAll('createMainRequest aborted: render process gone');
  });
  webContents.on('did-start-navigation', details => {
    // Same-document navigation (pushState, in-page anchor) preserves the
    // renderer's IPC handlers; only top-level cross-document navigation
    // discards them.
    if (!details.isMainFrame || details.isSameDocument) return;
    rejectAll('createMainRequest aborted: renderer reloaded');
  });

  const tracker: Tracker = { pending };
  trackerByWebContents.set(webContents, tracker);
  return tracker;
}

export function createMainRequest<Params, Return>(webContents: WebContents, key: string, params: Params): Promise<Return> {
  return new Promise<Return>((resolve, reject) => {
    if (webContents.isDestroyed()) {
      reject(new Error(`createMainRequest aborted for "${key}": webContents already destroyed`));
      return;
    }

    const requestId = nanoid();
    const pending = pendingForKey(key);
    const tracker = getTracker(webContents);

    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const release = () => {
      if (settled) return;
      settled = true;
      if (timeout !== null) clearTimeout(timeout);
      pending.delete(requestId);
      tracker.pending.delete(entry);
    };

    const entry: PendingEntry = {
      resolve(value) {
        if (settled) return;
        release();
        // IPC boundary — Return is guaranteed by the protocol contract, not by
        // static types (this map multiplexes Return types across callers).
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        resolve(value as Return);
      },
      reject(error) {
        if (settled) return;
        release();
        reject(error);
      },
    };

    pending.set(requestId, entry);
    tracker.pending.add(entry);

    timeout = setTimeout(() => {
      entry.reject(new Error(`createMainRequest timeout for "${key}" after ${REQUEST_TIMEOUT_MS}ms`));
    }, REQUEST_TIMEOUT_MS);

    webContents.send(requestKey(key), { requestId, value: params } satisfies Message<Params>);
  });
}
