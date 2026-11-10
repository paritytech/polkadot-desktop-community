import * as fs from 'node:fs';
import * as path from 'node:path';

import { electronProtocol } from '~config';
import { type IpcMainInvokeEvent, type Session, type WebContents, app, ipcMain, session, shell } from 'electron';

import {
  type DevicePermissionType,
  type ExecutableKind,
  type PermissionStatus,
  type ProductArchive,
  type RemotePermissionIpcRequest,
} from '@/domains/product';
import {
  WEBVIEW_HEALTH_STATE,
  WEBVIEW_RENDER_PROCESS_GONE,
  WEBVIEW_RENDER_PROCESS_RESPONSIVE,
  WEBVIEW_RENDER_PROCESS_UNRESPONSIVE,
} from '../shared/constants/webview-events';
import { createMainRequest } from '../shared/lib/events';

import { createArchiveMemoryCache } from './archive-memory-cache';
import { createArchiveStore } from './archive-store';
import { type SandboxHealthMonitor, createSandboxHealthMonitor } from './health';
import * as healthConstants from './health/constants';
import {
  canServeCachedEntry,
  evaluateNetworkRequest,
  isExternalUrlAllowed,
  listClearablePartitions,
  mapElectronPermission,
  parseProductLocalhostPort,
  parseSandboxPartition,
  resolveArchiveContent,
  resolveSandboxWillNavigate,
  sanitizeWebPreferences,
  validateArchiveDomain,
  validateArchiveFilePath,
  validateContenthash,
} from './lib';

export function setupSandbox(main: () => WebContents | null) {
  // Track configured partitions to avoid duplicate setup. Cleared on session reset
  // so a re-attached webview can have its protocol handlers reinstalled.
  const configuredPartitions = new Set<string>();

  // Per-partition remote-permission gate, keyed by the session object so the
  // per-webContents navigation handlers (registered in a different scope) can
  // reach the product-scoped check via `contents.session`. Never dropped, for the
  // same reason `configuredPartitions` isn't: handlers are bound to the long-lived
  // session and `session.fromPartition` returns the same instance on reuse.
  const remotePermissionGateBySession = new Map<Session, (url: string) => Promise<boolean>>();

  const archiveStore = createArchiveStore(path.join(app.getPath('userData'), 'product-archives'));

  const healthMonitor: SandboxHealthMonitor = createSandboxHealthMonitor({
    config: {
      heartbeatIntervalMs: healthConstants.HEARTBEAT_INTERVAL_MS,
      metricsIntervalMs: healthConstants.METRICS_INTERVAL_MS,
      heartbeatRttDegradedMs: healthConstants.HEARTBEAT_RTT_DEGRADED_MS,
      heartbeatTimeoutMs: healthConstants.HEARTBEAT_TIMEOUT_MS,
      heartbeatMissedToUnresponsive: healthConstants.HEARTBEAT_MISSED_TO_UNRESPONSIVE,
      memoryCeilingMb: healthConstants.MEMORY_CEILING_MB,
      memoryDegradedMb: healthConstants.MEMORY_DEGRADED_MB,
      cpuPinnedThresholdPct: healthConstants.CPU_PINNED_THRESHOLD_PCT,
      cpuPinnedSamples: healthConstants.CPU_PINNED_SAMPLES,
      degradeConsecutiveSamples: healthConstants.DEGRADE_CONSECUTIVE_SAMPLES,
      recoverConsecutiveSamples: healthConstants.RECOVER_CONSECUTIVE_SAMPLES,
      warmupSamplesAfterVisible: healthConstants.WARMUP_SAMPLES_AFTER_VISIBLE,
      initialVisibilityTimeoutMs: healthConstants.INITIAL_VISIBILITY_TIMEOUT_MS,
    },
    getAppMetrics: () => app.getAppMetrics(),
    now: () => Date.now(),
    emit: event => {
      const shellWC = main();
      if (!shellWC || shellWC.isDestroyed()) return;
      shellWC.send(WEBVIEW_HEALTH_STATE, event);
    },
  });

  // Reject IPC calls that did not originate from the shell renderer. Sandboxed
  // product webviews must never be able to call these handlers.
  function fromShell(event: IpcMainInvokeEvent): boolean {
    const shellWC = main();
    return !!shellWC && !shellWC.isDestroyed() && event.sender === shellWC;
  }

  function configureSandboxSession(partitionName: string) {
    if (configuredPartitions.has(partitionName)) return;
    configuredPartitions.add(partitionName);

    const ses = session.fromPartition(partitionName, { cache: false });

    const parsed = parseSandboxPartition(partitionName);
    const productId = parsed?.productId ?? null;
    const executable: ExecutableKind = parsed?.executable ?? 'app';
    const productLocalhostPort = parseProductLocalhostPort(productId);

    async function checkRemotePermission(url: string): Promise<boolean> {
      const mainWebContent = main();
      if (!productId || !mainWebContent) return false;

      try {
        const status = await createMainRequest<RemotePermissionIpcRequest, PermissionStatus>(mainWebContent, 'remotePermission', {
          productId,
          executable,
          request: { tag: 'Remote', url },
        });
        return status === 'granted';
      } catch (error) {
        // createMainRequest now rejects on timeout / renderer reload / crash.
        // Fail closed so a wedged renderer can't silently authorize traffic.
        console.warn('[sandbox] remotePermission request failed', { productId, url, error });
        return false;
      }
    }

    remotePermissionGateBySession.set(ses, checkRemotePermission);

    // Handle all requests within the widget scheme
    ses.protocol.handle(electronProtocol, async request => {
      const url = new URL(request.url);
      // Enforce the pinned/frozen version: a persisted (pinned) domain serves its frozen
      // bytes, never a contenthash-blind in-memory warm that could shadow it. A disk-backed
      // cache entry already carries the pinned contenthash (kept in sync by persist/delete),
      // so it is authoritative and skips the disk pointer read — the hot path for a pinned
      // product's many asset requests. Only a warm or a cache miss reads the pointer.
      const cached = archiveCache.peek(url.hostname);
      const pointer = cached && cached.contenthash !== null ? null : await archiveStore.readPointer(url.hostname);

      let archive: ProductArchive | undefined;
      if (cached && canServeCachedEntry(cached.contenthash, pointer?.contenthash ?? null)) {
        archive = archiveCache.get(url.hostname); // bumps LRU recency
      } else if (pointer) {
        const stored = await archiveStore.read(url.hostname, pointer.contenthash);
        if (stored) {
          archive = { domain: url.hostname, origin: stored.origin, files: stored.files };
          archiveCache.set(url.hostname, archive, true, pointer.contenthash);
        } else if (cached) {
          // The disk pointer names a pinned version, but its bytes are missing/corrupt
          // (read returned null). A contenthash-blind warm entry can't *shadow* a version
          // that isn't actually serveable, so fall back to the warm in-memory bytes: the
          // product still loads instead of 404ing. Only reachable when the warm entry was
          // rejected by canServeCachedEntry (its contenthash is null), so no pin is bypassed.
          archive = archiveCache.get(url.hostname); // bumps LRU recency
        }
      }
      if (!archive) return new Response('Unknown product', { statusText: request.url, status: 404 });

      const lookup = resolveArchiveContent(archive, url);
      if (!lookup) return new Response('Unknown product', { statusText: request.url, status: 404 });

      // @ts-expect-error Uint8Array is not assignable to response body
      return new Response(lookup.content, {
        status: lookup.status,
        headers: { 'Content-Type': lookup.mimeType },
      });
    });

    function blockedResponse(url: URL) {
      console.warn('[sandbox] Blocked network request', { productId, url: url.href });
      return new Response('Direct network access is blocked', { status: 403 });
    }

    // Block everything else — no http(s) allowed
    ses.protocol.handle('https', async request => {
      const url = new URL(request.url);
      const decision = evaluateNetworkRequest({
        scheme: 'https',
        url,
        productLocalhostPort,
      });
      if (decision === 'fetch-direct') return fetch(request);
      if (await checkRemotePermission(request.url)) return fetch(request);
      return blockedResponse(url);
    });

    ses.protocol.handle('http', async request => {
      const url = new URL(request.url);
      const decision = evaluateNetworkRequest({
        scheme: 'http',
        url,
        productLocalhostPort,
      });
      if (decision === 'fetch-direct') return fetch(request);
      if (await checkRemotePermission(request.url)) return fetch(request);
      return blockedResponse(url);
    });

    // WebSocket upgrade gating. ses.protocol.handle only intercepts http(s) schemes,
    // so wss:// and ws:// requests bypass the protocol handlers above. Route them
    // through the same checkRemotePermission flow via webRequest.
    ses.webRequest.onBeforeRequest({ urls: ['wss://*/*', 'ws://*/*'] }, async (details, callback) => {
      const url = new URL(details.url);
      const scheme = url.protocol === 'ws:' ? 'ws' : 'wss';
      const decision = evaluateNetworkRequest({
        scheme,
        url,
        productLocalhostPort,
      });
      if (decision === 'fetch-direct') {
        callback({ cancel: false });
        return;
      }
      const allowed = await checkRemotePermission(details.url);
      if (!allowed) {
        console.warn('[sandbox] Blocked WebSocket request', { productId, url: details.url });
      }
      callback({ cancel: !allowed });
    });

    ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
      // mapElectronPermission returns lib.DevicePermissionType[] (a subset of the
      // renderer's DevicePermissionType from @/domains/product); TS allows the
      // narrow → wide assignment without a cast. A single Electron `media` request
      // can require MORE than one device permission (audio + video → Microphone +
      // Camera), so we resolve each and grant only if EVERY one is granted.
      const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
      const requiredPermissions: DevicePermissionType[] = mapElectronPermission(permission, mediaTypes);
      const mainWebContent = main();

      if (requiredPermissions.length > 0 && productId && mainWebContent) {
        Promise.all(
          requiredPermissions.map(required =>
            createMainRequest<
              { productId: string; permission: DevicePermissionType; executable: ExecutableKind },
              PermissionStatus
            >(mainWebContent, 'devicePermission', {
              productId,
              permission: required,
              executable,
            }),
          ),
        )
          .then(statuses => callback(statuses.every(status => status === 'granted')))
          .catch(error => {
            // Fail closed — never grant a sensitive device permission when the
            // renderer can't be reached. callback MUST be invoked or Electron
            // leaves the request hanging.
            console.warn('[sandbox] devicePermission request failed', { productId, permissions: requiredPermissions, error });
            callback(false);
          });
      } else {
        // TODO remove this hack after bibip
        callback(permission === 'clipboard-sanitized-write');
      }
    });

    ses.setPermissionCheckHandler((_webContents, permission) => {
      // Only synchronous, always-safe capabilities may be answered here. Camera/
      // microphone (`media`) and geolocation are per-(product, modality) decisions
      // that can only be resolved through the async setPermissionRequestHandler
      // above — returning `true` here would let Chromium fast-grant capture WITHOUT
      // consulting the stored decision, bypassing per-modality enforcement entirely.
      // Returning false defers every such check to the gated request handler
      // (Electron's documented fall-through).
      return permission === 'clipboard-sanitized-write';
    });
  }

  // IPC

  // Chunked IPC handlers for receiving archives from renderer.
  // Archives are sent file-by-file to avoid passing large binary payloads
  // through a single IPC message, which causes serialization spikes and crashes.
  // ~256 MB ceiling for the in-memory archive cache. Only disk-backed entries are
  // evicted under pressure (see archive-memory-cache.ts); renderer-warmed entries
  // serving live webviews are retained.
  const ARCHIVE_MEMORY_CACHE_MAX_BYTES = 256 * 1024 * 1024;
  const archiveCache = createArchiveMemoryCache(ARCHIVE_MEMORY_CACHE_MAX_BYTES);
  const pendingArchives = new Map<string, ProductArchive>();

  ipcMain.handle('initArchive', (event, { domain, origin }: { domain: string; origin: string }) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    const validation = validateArchiveDomain(domain);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    pendingArchives.set(validation.domain, { domain: validation.domain, origin, files: {} });
    return { success: true };
  });

  ipcMain.handle(
    'saveArchiveFile',
    (event, { domain, filePath, content }: { domain: string; filePath: string; content: Uint8Array }) => {
      if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
      const validation = validateArchiveFilePath(filePath);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }
      const archive = pendingArchives.get(domain);
      if (!archive) {
        return { success: false, error: 'Archive not initialized' };
      }
      archive.files[filePath] = content;
      return { success: true };
    },
  );

  ipcMain.handle('finalizeArchive', (event, domain: string) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    const archive = pendingArchives.get(domain);
    if (!archive) {
      return { success: false, error: 'Archive not initialized' };
    }
    pendingArchives.delete(domain);
    // Renderer warm (saveArchive) — in-memory only, not persisted. Not evictable.
    archiveCache.set(domain, archive, false);
    return { success: true };
  });

  ipcMain.handle('archive:persistToDisk', async (event, { domain, contenthash }: { domain: string; contenthash: string }) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    const validation = validateArchiveDomain(domain);
    if (!validation.ok) return { success: false, error: validation.error };
    const hashValidation = validateContenthash(contenthash);
    if (!hashValidation.ok) return { success: false, error: hashValidation.error };
    const pending = pendingArchives.get(validation.domain);
    if (!pending) return { success: false, error: 'Archive not initialized' };

    const encoder = new TextEncoder();
    const bytes: Record<string, Uint8Array> = {};
    for (const [filePath, content] of Object.entries(pending.files)) {
      bytes[filePath] = typeof content === 'string' ? encoder.encode(content) : content;
    }
    try {
      await archiveStore.persist(validation.domain, hashValidation.contenthash, pending.origin, bytes);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    // Just written to disk → re-servable, so safe to evict from memory later. Tag with
    // the contenthash so the serve decision recognizes it as the pinned/frozen version.
    archiveCache.set(validation.domain, pending, true, hashValidation.contenthash);
    pendingArchives.delete(validation.domain);
    return { success: true };
  });

  // Chunked read (main → renderer), mirroring the chunked write: the renderer
  // pulls the manifest (origin + file paths) then each file individually, so a
  // large worker archive never crosses IPC as one giant payload.
  ipcMain.handle('archive:get:manifest', async (event, { domain, contenthash }: { domain: string; contenthash: string }) => {
    if (!fromShell(event)) return null;
    const validation = validateArchiveDomain(domain);
    if (!validation.ok) return null;
    const hashValidation = validateContenthash(contenthash);
    if (!hashValidation.ok) return null;
    return archiveStore.readManifest(validation.domain, hashValidation.contenthash);
  });

  ipcMain.handle(
    'archive:get:file',
    async (event, { domain, contenthash, filePath }: { domain: string; contenthash: string; filePath: string }) => {
      if (!fromShell(event)) return null;
      const validation = validateArchiveDomain(domain);
      if (!validation.ok) return null;
      const hashValidation = validateContenthash(contenthash);
      if (!hashValidation.ok) return null;
      const pathValidation = validateArchiveFilePath(filePath);
      if (!pathValidation.ok) return null;
      return archiveStore.readFile(validation.domain, hashValidation.contenthash, filePath);
    },
  );

  ipcMain.handle('archive:has', async (event, { domain, contenthash }: { domain: string; contenthash: string }) => {
    if (!fromShell(event)) return false;
    const validation = validateArchiveDomain(domain);
    if (!validation.ok) return false;
    const hashValidation = validateContenthash(contenthash);
    if (!hashValidation.ok) return false;
    return archiveStore.has(validation.domain, hashValidation.contenthash);
  });

  ipcMain.handle('archive:delete', async (event, domain: string) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    const validation = validateArchiveDomain(domain);
    if (!validation.ok) return { success: false, error: validation.error };
    archiveCache.delete(validation.domain);
    await archiveStore.delete(validation.domain);
    return { success: true };
  });

  ipcMain.handle('archive:list', async event => {
    if (!fromShell(event)) return [];
    return archiveStore.list();
  });

  ipcMain.handle('archive:clearAll', async event => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    archiveCache.clear();
    await archiveStore.clearAll();
    return { success: true };
  });

  // Wipe user data stored in the product sandbox partition (localStorage, cookies,
  // HTTP cache). Does not evict the in-memory product bundle — live webviews still
  // need archiveCache to serve polkadot:// assets after a Clear Cache action.
  async function clearProductSessionData(identifier: string): Promise<void> {
    // Don't drop the partition from configuredPartitions: Electron protocol
    // handlers are bound to the session object and survive clearStorageData.
    // Re-running configureSandboxSession would call ses.protocol.handle on a
    // session that already has the same scheme registered, which throws inside
    // will-attach-webview and leaves the next webview hung (no dom-ready, no
    // did-fail-load).
    // { cache: false } must match how the webview session was originally created
    // in configureSandboxSession; otherwise fromPartition returns a different object.
    // Only configured partitions are cleared — fromPartition lazily creates a
    // session, so touching never-opened partitions would materialize them.
    await Promise.all(
      listClearablePartitions(identifier, configuredPartitions).map(async partitionName => {
        try {
          const ses = session.fromPartition(partitionName, { cache: false });
          await Promise.all([ses.clearStorageData(), ses.clearCache()]);
        } catch (error) {
          console.warn('[sandbox] clearStorageData failed for', identifier, partitionName, error);
        }
      }),
    );
  }

  // Evict in-memory archives for this product. Archives live under per-kind
  // subnames (`<kind>.<base>`) in the manifest layout, so a single delete by base name
  // misses everything — iterate kinds and drop any legacy bare-name entry.
  function evictSandboxArchives(identifier: string): void {
    for (const kind of ['app', 'widget', 'worker']) {
      const subname = `${kind}.${identifier}`;
      archiveCache.delete(subname);
      pendingArchives.delete(subname);
    }
    archiveCache.delete(identifier);
    pendingArchives.delete(identifier);
  }

  // Full sandbox reset: evict the product bundle and wipe partition storage.
  // Used by forget/reset flows where the webview is torn down and the archive
  // must be re-fetched before the product can load again.
  async function dropSandboxState(identifier: string): Promise<void> {
    evictSandboxArchives(identifier);
    for (const kind of ['app', 'widget', 'worker']) {
      await archiveStore.delete(`${kind}.${identifier}`);
    }
    await archiveStore.delete(identifier);
    await clearProductSessionData(identifier);
  }

  // Untrusted: comes from the sandboxed product preload. Sender authentication
  // is implicit — we look up the entry by event.sender.id and the monitor drops
  // pongs for unknown entries or stale seqs.
  ipcMain.on('sandbox:pong', (event, payload: { seq: number; t: number }) => {
    if (!payload || typeof payload.seq !== 'number') return;
    healthMonitor.handlePong(event.sender.id, payload.seq);
  });

  // Trusted: only the shell renderer reports visibility for sandboxed webviews.
  ipcMain.handle('sandbox:visibility', (event, { webContentsId, visible }: { webContentsId: number; visible: boolean }) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    if (typeof webContentsId !== 'number' || typeof visible !== 'boolean') {
      return { success: false, error: 'Invalid payload' };
    }
    healthMonitor.setVisible(webContentsId, visible);
    return { success: true };
  });

  ipcMain.handle('sandbox:clear-data', async (event, identifier: string) => {
    if (!fromShell(event)) return;
    await dropSandboxState(identifier);
  });

  ipcMain.handle('clearProductData', async (event, productId: string) => {
    if (!fromShell(event)) return { success: false, error: 'Unauthorized' };
    if (!productId || typeof productId !== 'string') {
      return { success: false, error: 'Invalid productId' };
    }
    try {
      await clearProductSessionData(productId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  let preloadSaved = false;

  // Handle webview attachment — enforce sandbox session
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (_event, webPreferences, params) => {
      const preloadPath = path.join(app.getPath('temp'), 'sandbox-preload.js');

      if (!preloadSaved) {
        const preloadCode = `
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('__HOST_WEBVIEW_MARK__', true);
  ipcRenderer.on('sandbox:ping', (_e, seq) => {
    try { ipcRenderer.send('sandbox:pong', { seq, t: performance.now() }); } catch (_) {}
  });
  // Trackpad swipe navigation: the host reduces these into a back/forward gesture. "consumed" follows
  // Chrome's overscroll rule — the page scrolls first, and only a wheel it cannot use becomes a swipe.
  // The root scroller's overflow is the viewport's: html's, or body's when html's is visible (CSS propagation).
  const rootOverflowX = () => {
    const html = getComputedStyle(document.documentElement).overflowX;
    return html !== 'visible' || !document.body ? html : getComputedStyle(document.body).overflowX;
  };
  const canScrollX = (el, deltaX) => {
    if (!(el instanceof Element) || el.scrollWidth <= el.clientWidth) return false;
    // When html's overflow is visible, body's overflow propagates to the viewport: body itself never scrolls.
    if (el === document.body && el !== document.scrollingElement && getComputedStyle(document.documentElement).overflowX === 'visible') return false;
    if (el === document.scrollingElement) {
      const overflowX = rootOverflowX();
      if (overflowX === 'hidden' || overflowX === 'clip') return false;
    } else {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX !== 'auto' && overflowX !== 'scroll') return false;
    }
    const left = Math.abs(el.scrollLeft);
    return deltaX < 0 ? left > 0 : left + el.clientWidth < el.scrollWidth - 1;
  };
  // Chrome's opt-out from swipe navigation: overscroll-behavior-x other than auto on a scroll container in the chain.
  // It applies only to scroll containers, and the viewport takes it from html alone — never from body.
  const optsOutOfSwipe = (el) => {
    if (!(el instanceof Element) || el === document.body) return false;
    const style = getComputedStyle(el);
    if (style.overscrollBehaviorX === 'auto') return false;
    return el === document.documentElement || (style.overflowX !== 'visible' && style.overflowX !== 'clip');
  };
  window.addEventListener('wheel', (event) => {
    if (!event.isTrusted || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const { deltaX, deltaY } = event;
    if (deltaX === 0 && deltaY === 0) return;
    // composedPath() is empty once dispatch ends, so the scroll check runs now; defaultPrevented is final only after.
    const scrollable = deltaX !== 0 && event.composedPath().some((el) => canScrollX(el, deltaX) || optsOutOfSwipe(el));
    setTimeout(() => {
      try { ipcRenderer.sendToHost('host:wheel', { deltaX, deltaY, consumed: scrollable || event.defaultPrevented }); } catch (_) {}
    }, 0);
  }, { passive: true });
`;

        preloadSaved = true;
        fs.writeFileSync(preloadPath, preloadCode);
      }

      sanitizeWebPreferences(webPreferences, preloadPath);

      // Configure per-product sandbox session before webview loads
      const partition = params['partition'];
      if (partition && partition.startsWith('sandbox-')) {
        configureSandboxSession(partition);
      }
    });

    // The navigation/window/crash policy below is the sandbox firewall for product
    // webviews. Attaching it to the shell renderer or to non-webview contents would
    // hijack OAuth popups, dev-server reloads, etc.
    if (contents.getType() !== 'webview') return;

    healthMonitor.attach({
      webContentsId: contents.id,
      webContents: contents,
      productId: null, // renderer beacon will provide productId via visibility/health updates; partition resolution can be added later
      visible: false, // renderer beacon will flip this to true once mounted
    });

    contents.on('destroyed', () => {
      healthMonitor.detach(contents.id);
    });

    function sendToShell(channel: string, payload: object): void {
      const shellWC = main();
      if (!shellWC || shellWC.isDestroyed()) return;
      shellWC.send(channel, payload);
    }

    // Open an external URL in the system browser, but only after the product owning this
    // webview grants the Open-External-URL permission. Shared by both external-open paths
    // (will-navigate and setWindowOpenHandler); fails closed when no product context is
    // registered for the session.
    function openExternalIfPermitted(href: string, context: 'navigation' | 'open'): void {
      const gate = remotePermissionGateBySession.get(contents.session);
      if (!gate) {
        console.warn(`[sandbox] No product context for external ${context}, blocked:`, href);
        return;
      }
      void gate(href).then(granted => {
        if (granted) shell.openExternal(href);
        else console.warn(`[sandbox] External ${context} denied by permission:`, href);
      });
    }

    // Block navigation outside widget scheme (allow localhost for developers, allow .dot domains for cross-product links)
    // TODO: separate dev and prod builds and exclude localhost in prod builds
    contents.on('will-navigate', (event, url) => {
      const decision = resolveSandboxWillNavigate(url, electronProtocol);
      if (decision.action === 'allow') return;

      event.preventDefault();
      if (decision.openExternalHref) {
        openExternalIfPermitted(decision.openExternalHref, 'navigation');
      } else {
        console.warn('[sandbox] Blocked navigation to:', url);
      }
    });

    // A cross-product `window.open` has to reach a host tab, not the system browser.
    // Which URLs are products is not knowable here: it depends on the active network's
    // dotNS TLD and its `.li` gateway aliases, and nothing in the main process tracks
    // either. So the shell decides and opens the tab; main only routes, and keeps the
    // external path (with its per-product permission gate) for everything else.
    //
    // Always denies: the handler must answer synchronously, and both outcomes are
    // asynchronous — the shell is asked over IPC, and an external open awaits a
    // permission decision. Nothing is ever opened as an Electron popup window.
    contents.setWindowOpenHandler(({ url }) => {
      void routeWindowOpen(url);

      return { action: 'deny' };
    });

    async function routeWindowOpen(url: string): Promise<void> {
      if (await openedInShell(url)) return;

      const result = isExternalUrlAllowed(url);
      if (result.allowed && result.href) {
        openExternalIfPermitted(result.href, 'open');
      } else {
        console.warn('[sandbox] Blocked shell.openExternal for:', url);
      }
    }

    // `true` once the shell has recognised the URL as a product and opened a tab for it.
    // A shell that is gone, wedged or erroring answers `false`, which falls the caller
    // through to the external path — the behaviour this had before it could ask.
    async function openedInShell(url: string): Promise<boolean> {
      const shellWC = main();
      if (!shellWC || shellWC.isDestroyed()) return false;

      try {
        return await createMainRequest<{ url: string }, boolean>(shellWC, 'sandboxWindowOpen', { url });
      } catch (error) {
        console.warn('[sandbox] sandboxWindowOpen request failed', { url, error });

        return false;
      }
    }

    contents.on('render-process-gone', (_, details) => {
      sendToShell(WEBVIEW_RENDER_PROCESS_GONE, {
        webContentsId: contents.id,
        url: contents.getURL(),
        reason: details.reason,
        exitCode: details.exitCode,
        at: Date.now(),
      });
    });

    // Unlike a crash, an unresponsive renderer is still alive and may recover —
    // we also forward 'responsive' so the overlay dismisses automatically.
    contents.on('unresponsive', () => {
      sendToShell(WEBVIEW_RENDER_PROCESS_UNRESPONSIVE, {
        webContentsId: contents.id,
        url: contents.getURL(),
        at: Date.now(),
      });
    });

    contents.on('responsive', () => {
      sendToShell(WEBVIEW_RENDER_PROCESS_RESPONSIVE, {
        webContentsId: contents.id,
        at: Date.now(),
      });
    });
  });
}
