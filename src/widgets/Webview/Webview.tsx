import { type Container, createContainer, createWebviewProvider } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { useTheme } from '@novasamatech/tr-ui';
import { type DidFailLoadEvent, type DidNavigateInPageEvent, type WebviewTag, type WillNavigateEvent } from 'electron';
import { type ReactNode, memo, useEffect, useMemo, useRef, useState } from 'react';
import { type Observable } from 'rxjs';

import { useLooseRef, usePrevious } from '@/shared/hooks';
import { useTranslation } from '@/shared/translation';
import { cnTw, nonNullable } from '@/shared/utils';
import {
  type DotNsUrl,
  type ExecutableKind,
  dotNsService,
  isLocalhostUrl,
  normalizeLocalhostUrl,
  permissionsService,
  useDisplayedProduct,
  useExecutableArchive,
} from '@/domains/product';
import { useFindInPageExecutor } from '@/aggregates/find-in-page';
import { productLoading } from '@/aggregates/product-loading';
import { useWebviewCrash, useWebviewHealth, useWebviewUnresponsive, webviewRegistry } from '@/aggregates/webview-registry';
import { useWebviewZoomExecutor } from '@/aggregates/webview-zoom';
import { ProductContainerBinding } from '@/widgets/ProductContainerBinding';

import { decideDidNavigate, decideDidNavigateInPage, decideWillNavigate } from './navigation';
import { CrashOverlay } from './ui/CrashOverlay';
import { DegradedBanner } from './ui/DegradedBanner';
import { UnresponsiveOverlay } from './ui/UnresponsiveOverlay';

// The codebase's pathname convention (set by parseDotNsDomain) is no leading slash:
// 'sub' for /sub, '' for root. TanStack Router's `{-$route}` optional param also
// surfaces values without a leading slash. Strip any leading slash defensively
// here so lastWebviewPathnameRef and onPathnameChange match the parent's format
// and the equality guard in the src-derivation effect fires correctly.
function stripLeadingSlash(pathname: string): string {
  return pathname.startsWith('/') ? pathname.slice(1) : pathname;
}

// Mirror of main/sandbox/lib.ts `buildSandboxPartition` — the renderer cannot
// import main/ code in production, so the partition format lives in two places.
// The cross-target drift test in Webview.test.tsx pins this to the main-process
// builder across every executable kind; keep the two in sync.
function buildSandboxPartition(identifier: string, kind: ExecutableKind): string {
  const slot = kind === 'widget' ? 'widget' : 'app';
  return `sandbox-${slot}-${encodeURIComponent(identifier)}`;
}

type Props = {
  identifier: string;
  /**
   * Which executable subname to resolve under `identifier`. Defaults to 'app'
   * — the full-screen SPA. ProductWidgetBody passes 'widget' to mount the
   * widget executable's archive instead.
   */
  kind: ExecutableKind;
  pathname?: string;
  /**
   * Fired when the guest page navigates within this product (SPA pushState,
   * replaceState, same-product anchor click). The owner should update the
   * tab's pathname in tabs$; router sync is not this component's concern.
   */
  onPathnameChange?: (pathname: string) => void;
  /**
   * Fired when the guest page tries to navigate to a different product via a
   * polkadot:// link. The owner decides whether to open the target in a new
   * tab — this component preventDefaults the navigation either way so its
   * own webview stays on its own product.
   */
  onCrossProductLink?: (target: DotNsUrl) => void;
  reloadTrigger$?: Observable<void>;
  loader?: ReactNode;
  /**
   * Whether this webview's tab is currently visible.
   * Drives the visibility beacon so the health monitor can gate heartbeat checks.
   */
  visible: boolean;
};

/**
 * Special sandbox component that can run product modality inside.
 */
export const Webview = memo(
  ({ identifier, kind, pathname, loader, reloadTrigger$, onPathnameChange, onCrossProductLink, visible }: Props) => {
    const { mode } = useTheme();
    const { t } = useTranslation();
    const onPathnameChangeRef = useLooseRef(onPathnameChange);
    const onCrossProductLinkRef = useLooseRef(onCrossProductLink);

    const localhost = isLocalhostUrl(identifier);
    // Single chokepoint for the kind → modality rule (worker enforces against 'app').
    const modality = permissionsService.modalityForKind(kind);

    // The archive's on-chain location is product-specific (`app.<base>` for a
    // manifest product, the bare base for a legacy product), so resolve the product
    // and hand it to the archive resource, which reads the executable's identifier off it.
    const { data: product, pending: productPending, error: productError } = useDisplayedProduct(localhost ? null : identifier);
    const {
      data: content,
      pending: archivePending,
      error: archiveError,
    } = useExecutableArchive(localhost || !product ? null : { product, kind });

    const pending = localhost ? false : productPending || (nonNullable(product) && archivePending);
    const ready = localhost || nonNullable(content);

    // The loader must yield to the error UI once resolution settles with nothing
    // — otherwise `(pending || webviewLoading) && !cannotResolve && ...` pins it
    // forever. "Settled with nothing" spans: product not found, or the archive
    // request settled empty (missing executable, no resolver, decode failure).
    const productMissing = !localhost && !productPending && !nonNullable(product);
    const archiveMissing = !localhost && nonNullable(product) && !archivePending && !nonNullable(content);
    const cannotResolve = nonNullable(productError) || nonNullable(archiveError) || productMissing || archiveMissing;

    const navIdentifier = localhost ? identifier : (content?.archive.domain ?? identifier);

    // wasReady keeps the <webview> mounted across transient ready→pending dips so a
    // session reload doesn't tear down the guest webContents. It must reset on
    // identifier change (new product) and on resolve/fetch errors (show error UI).
    const [wasReady, setWasReady] = useState(false);
    useEffect(() => {
      if (ready) setWasReady(true);
      else if (cannotResolve) setWasReady(false);
    }, [ready, cannotResolve]);
    useEffect(() => {
      setWasReady(false);
      setLoadError(null);
    }, [identifier]);

    const [webviewLoading, setWebviewLoading] = useState(true);
    const [loadError, setLoadError] = useState<{ code: number; description: string } | null>(null);

    useEffect(() => {
      productLoading.set(identifier, true);
      return () => productLoading.set(identifier, false);
    }, [identifier]);

    useEffect(() => {
      if (cannotResolve) {
        productLoading.set(identifier, false);
      }
    }, [identifier, cannotResolve]);

    const crash = useWebviewCrash(identifier);
    const unresponsive = useWebviewUnresponsive(identifier);
    const health = useWebviewHealth(identifier);
    const degraded = !crash && !unresponsive && health?.state === 'degraded';

    const { session } = useSession();
    const prevSession = usePrevious(session);

    const [container, setContainer] = useState<Container | null>(null);
    const [webviewRef, setWebviewRef] = useState<WebviewTag | null>(null);
    const lastWebviewPathnameRef = useRef<string | null>(null);

    // Drive native Cmd+F find on this tab's guest content. `identifier` is the tab id.
    useFindInPageExecutor(identifier, webviewRef);

    // Apply per-product zoom (Cmd +/-/0) to this tab's guest content.
    useWebviewZoomExecutor(identifier, webviewRef);

    useEffect(() => {
      if (!webviewRef) return;

      const onStopLoading = () => {
        productLoading.set(identifier, false);
      };
      const onFinishLoad = () => {
        productLoading.set(identifier, false);
        setWebviewLoading(false);
        setLoadError(null);
      };
      const onFailLoad = (e: DidFailLoadEvent) => {
        productLoading.set(identifier, false);
        setWebviewLoading(false);
        if (!e.isMainFrame) return;
        // ERR_ABORTED — user-initiated stop or a superseding navigation. Not a real failure.
        if (e.errorCode === -3) return;
        setLoadError({ code: e.errorCode, description: e.errorDescription });
      };

      webviewRef.addEventListener('did-stop-loading', onStopLoading);
      webviewRef.addEventListener('did-finish-load', onFinishLoad);
      webviewRef.addEventListener('did-fail-load', onFailLoad);
      return () => {
        webviewRef.removeEventListener('did-stop-loading', onStopLoading);
        webviewRef.removeEventListener('did-finish-load', onFinishLoad);
        webviewRef.removeEventListener('did-fail-load', onFailLoad);
      };
    }, [webviewRef, identifier]);

    useEffect(() => {
      if (!webviewRef || kind !== 'widget') return;

      // Dashboard product widgets are glanceable, fixed-size surfaces — the product's
      // widget presentation must not scroll. Chat and favorites are plain React cards
      // (not webviews), so this only affects product widgets. insertCSS applies to the
      // current document, so re-apply after every load. dom-ready and did-finish-load
      // both fire per load, so drop the previous insertion before re-applying to avoid
      // stacking duplicate stylesheets.
      let insertedKey: string | null = null;

      const disableScroll = async () => {
        if (insertedKey) {
          // Stale after a navigation; removal best-effort, must not block re-insertion.
          await webviewRef.removeInsertedCSS(insertedKey).catch(() => {});
          insertedKey = null;
        }
        try {
          insertedKey = await webviewRef.insertCSS('html,body{overflow:hidden !important}');
        } catch {
          /* guest not ready yet — a later load event re-applies */
        }
      };

      webviewRef.addEventListener('dom-ready', disableScroll);
      webviewRef.addEventListener('did-finish-load', disableScroll);
      return () => {
        webviewRef.removeEventListener('dom-ready', disableScroll);
        webviewRef.removeEventListener('did-finish-load', disableScroll);
      };
    }, [webviewRef, kind]);

    useEffect(() => {
      if (!webviewRef) return;

      // dom-ready can fire before the guest webContents is fully attached, in which
      // case getWebContentsId throws. did-finish-load runs strictly after attach, so
      // it's a reliable fallback. webviewRegistry.register is idempotent.
      const publish = () => {
        try {
          webviewRegistry.register(identifier, webviewRef.getWebContentsId());
        } catch {
          /* not attached yet — a later event will retry */
        }
      };

      webviewRef.addEventListener('dom-ready', publish);
      webviewRef.addEventListener('did-finish-load', publish);
      return () => {
        webviewRef.removeEventListener('dom-ready', publish);
        webviewRef.removeEventListener('did-finish-load', publish);
        webviewRegistry.unregister(identifier);
      };
    }, [webviewRef, identifier]);

    useEffect(() => {
      if (!webviewRef) return;

      let currentId: number | null = null;

      const sync = () => {
        let id: number;
        try {
          id = webviewRef.getWebContentsId();
        } catch {
          return; // webview not attached yet; next event retries
        }
        if (currentId !== null && currentId !== id) {
          // webContentsId changed under us (reload, navigation). Tell main the
          // previous one is gone before announcing the new one.
          window.App?.sendWebviewVisibility?.(currentId, false);
        }
        currentId = id;
        window.App?.sendWebviewVisibility?.(id, visible);
      };

      webviewRef.addEventListener('dom-ready', sync);
      webviewRef.addEventListener('did-finish-load', sync);
      // Sync immediately for the case where the webview attached before this effect
      // ran (visible prop changes while already mounted).
      sync();

      return () => {
        webviewRef.removeEventListener('dom-ready', sync);
        webviewRef.removeEventListener('did-finish-load', sync);
        if (currentId !== null) {
          window.App?.sendWebviewVisibility?.(currentId, false);
        }
      };
    }, [webviewRef, visible]);

    useEffect(() => {
      if (!webviewRef || !ready) return;
      if (prevSession === session) return;

      webviewRef.reload();
    }, [webviewRef, ready, prevSession, session]);

    useEffect(() => {
      if (!webviewRef || !ready) return;

      const provider = createWebviewProvider({ webview: webviewRef, openDevTools: false });
      const container = createContainer(provider);

      setContainer(container);

      let onConsoleMessage: ((e: Electron.ConsoleMessageEvent) => void) | null = null;
      if (localhost || dotNsService.isDotDomain(identifier)) {
        onConsoleMessage = e => {
          // eslint-disable-next-line no-console
          const methods = [console.debug, console.info, console.warn, console.error] as const;
          const log = methods[e.level] ?? console.info;
          log(`[${identifier}]`, e.message);
        };
        webviewRef.addEventListener('console-message', onConsoleMessage);
      }

      // track=true mirrors what the webview navigated to into lastWebviewPathnameRef;
      // track=false skips the ref because the webview hasn't actually moved yet
      // (the src effect will reload it once the parent's tab state catches up).
      const emitPathnameChange = (pathname: string, track: boolean) => {
        const normalized = stripLeadingSlash(pathname);
        if (track) lastWebviewPathnameRef.current = normalized;
        onPathnameChangeRef()?.(normalized);
      };
      const emitCrossProductLink = (target: DotNsUrl) => {
        onCrossProductLinkRef()?.(target);
      };

      const onWillNavigate = (e: WillNavigateEvent) => {
        const decision = decideWillNavigate({ url: e.url, identifier: navIdentifier, localhost });
        switch (decision.type) {
          case 'allow':
            return;
          case 'deny':
            e.preventDefault();
            return;
          case 'sync-pathname':
            if (!decision.track) e.preventDefault();
            emitPathnameChange(decision.pathname, decision.track);
            return;
          case 'cross-product':
            e.preventDefault();
            if (decision.stop) webviewRef.stop();
            emitCrossProductLink(decision.target);
            return;
          case 'revert-to-desired':
            // Not produced by decideWillNavigate; exhaustive switch keeps the compiler honest.
            return;
        }
      };
      webviewRef.addEventListener('will-navigate', onWillNavigate);

      const onDidNavigateInPage = (e: DidNavigateInPageEvent) => {
        const decision = decideDidNavigateInPage({
          url: e.url,
          identifier: navIdentifier,
          localhost,
          isMainFrame: e.isMainFrame,
        });

        if (decision.type === 'sync-pathname') emitPathnameChange(decision.pathname, decision.track);
      };
      webviewRef.addEventListener('did-navigate-in-page', onDidNavigateInPage);

      // Fallback for polkadot:// cross-product navigation. The `will-navigate` preventDefault above
      // races with the main process: polkadot:// URLs are served from an in-memory archive cache with
      // no network latency, so the protocol handler resolves instantly. Meanwhile, the renderer's
      // will-navigate event travels over IPC (main → renderer → main) and often arrives after the
      // navigation has already committed a 404 response. When that happens, undo it with goBack().
      const revertToDesired = () => {
        const target = desiredSrcRef.current;
        if (target) webviewRef.loadURL(target);
        else webviewRef.goBack();
      };

      const onDidNavigate = (e: { url: string }) => {
        const decision = decideDidNavigate({ url: e.url, identifier: navIdentifier });

        if (decision.type === 'revert-to-desired') revertToDesired();
      };
      webviewRef.addEventListener('did-navigate', onDidNavigate);

      return () => {
        webviewRef.removeEventListener('will-navigate', onWillNavigate);
        webviewRef.removeEventListener('did-navigate-in-page', onDidNavigateInPage);
        webviewRef.removeEventListener('did-navigate', onDidNavigate);
        if (onConsoleMessage) {
          webviewRef.removeEventListener('console-message', onConsoleMessage);
        }
        container.dispose();
        setContainer(null);
      };
    }, [identifier, webviewRef, ready]);

    const desiredSrc = useMemo(() => {
      const path = `/${stripLeadingSlash(pathname ?? '')}`;
      if (localhost) return new URL(path, normalizeLocalhostUrl(identifier)).toString();
      return content ? new URL(path, content.archive.origin).toString() : '';
    }, [localhost, identifier, content, pathname]);
    const desiredSrcRef = useRef(desiredSrc);
    desiredSrcRef.current = desiredSrc;

    const [src, setSrc] = useState('');
    // Read via ref so reloadTrigger$ always picks up the current src instead of
    // re-subscribing on every src change (which races with concurrent reloads).
    const srcRef = useRef(src);
    srcRef.current = src;

    useEffect(() => {
      if (!desiredSrc) return;
      if (lastWebviewPathnameRef.current === stripLeadingSlash(pathname ?? '')) return;
      setSrc(desiredSrc);
      setLoadError(null);
    }, [desiredSrc, pathname]);

    useEffect(() => {
      if (!reloadTrigger$ || !webviewRef || !ready) return;
      const sub = reloadTrigger$.subscribe(() => webviewRef.loadURL(srcRef.current));
      return () => sub.unsubscribe();
    }, [reloadTrigger$, webviewRef, ready]);

    return (
      <div className="h-full w-full overflow-hidden select-none">
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-general-muted">
          {(ready || wasReady) && src ? (
            <webview
              className={cnTw(
                'relative h-full w-full grow overflow-hidden transition-[filter] duration-200',
                {
                  'scheme-light': mode === 'light',
                  'scheme-dark': mode === 'dark',
                },
                unresponsive && !crash && 'pointer-events-none blur-sm grayscale',
              )}
              data-testid="webview-host"
              // @ts-expect-error incorrect type on react side
              ref={setWebviewRef}
              // eslint-disable-next-line react/no-unknown-property
              partition={buildSandboxPartition(identifier, kind)}
              // allowpopups routes target=_blank clicks to setWindowOpenHandler
              // @ts-expect-error typed boolean upstream, but only the string attr reaches the DOM
              allowpopups="true" // eslint-disable-line react/no-unknown-property
              src={src}
            />
          ) : null}

          {cannotResolve ? (
            <div className="absolute inset-0 m-auto h-fit w-fit">{t('widget.webview.error.domainResolve')}</div>
          ) : null}
          {loadError && !cannotResolve && !crash ? (
            <div className="absolute inset-0 m-auto h-fit w-fit" data-testid="webview-load-error">
              {t('widget.webview.error.loadFailed', { code: loadError.code, description: loadError.description })}
            </div>
          ) : null}

          {crash ? (
            <CrashOverlay
              crash={crash}
              onReload={() => {
                webviewRegistry.clearCrash(crash.webContentsId);
                setLoadError(null);
                webviewRef?.reload();
              }}
            />
          ) : unresponsive ? (
            <UnresponsiveOverlay
              info={unresponsive}
              onReload={() => {
                webviewRegistry.clearUnresponsive(unresponsive.webContentsId);
                setLoadError(null);
                webviewRef?.reload();
              }}
            />
          ) : null}

          {degraded && health ? (
            <DegradedBanner
              reason={health.reason}
              onReload={() => {
                webviewRegistry.clearHealth(health.webContentsId);
                setLoadError(null);
                webviewRef?.reload();
              }}
            />
          ) : null}

          {(pending || webviewLoading) && !cannotResolve && !loadError && !crash && !unresponsive && (
            <div className="absolute inset-0">{loader}</div>
          )}
        </div>

        {container ? <ProductContainerBinding container={container} identifier={identifier} modality={modality} /> : null}
      </div>
    );
  },
);
