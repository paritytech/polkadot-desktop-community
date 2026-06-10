import { type WebviewTag } from 'electron';
import { useEffect, useMemo } from 'react';

import { useRxState } from '@/shared/rxstate';

import { levelToPercent, webviewZoom } from './state/levels';

/** Current zoom percentage for a product (100 when never zoomed). */
export function useZoomPercent(productId: string): number {
  const [levels] = useRxState(webviewZoom.levels$);
  return levelToPercent(levels[productId] ?? 0);
}

/** Command bindings for the indicator buttons, pre-scoped to a product. */
export function useZoomControls(productId: string) {
  return useMemo(
    () => ({
      zoomIn: () => webviewZoom.zoomIn(productId),
      zoomOut: () => webviewZoom.zoomOut(productId),
      reset: () => webviewZoom.reset(productId),
    }),
    [productId],
  );
}

// `setZoomLevel` throws if the guest webContents isn't attached and `dom-ready` yet
// (e.g. on first mount). Guard it — callers rely on dom-ready / did-finish-load to
// apply it once the guest is live. (Same defensive pattern the Webview widget uses
// around `getWebContentsId`.)
function applyZoomLevel(webview: WebviewTag, level: number): void {
  try {
    webview.setZoomLevel(level);
  } catch {
    // guest not attached yet — a dom-ready / did-finish-load event will apply it
  }
}

/**
 * Applies the product's zoom level to the guest content. Lives as a hook (not a use
 * case) because its input — the `WebviewTag` element — is React/DOM-only; the Webview
 * widget that owns the element is the sole caller. Mirrors useFindInPageExecutor.
 */
export function useWebviewZoomExecutor(productId: string, webview: WebviewTag | null): void {
  const [levels] = useRxState(webviewZoom.levels$);
  const level = levels[productId] ?? 0;

  // Apply immediately when the level changes so a Cmd +/- takes effect without
  // waiting for a reload (no-op before the guest attaches; the listeners below
  // apply it then).
  useEffect(() => {
    if (!webview) return;
    applyZoomLevel(webview, level);
  }, [webview, level]);

  // The guest resets its zoom when it first attaches and on every full document load
  // (reload, or navigation to a new document), so (re)apply the current level on
  // `dom-ready` and `did-finish-load`. `dom-ready` is also what makes the very first
  // apply land — before it, `setZoomLevel` throws. We intentionally do NOT listen to
  // `did-navigate-in-page` (unlike find-in-page's executor): zoom is a webContents
  // property that survives in-page SPA navigation, whereas find must rebuild
  // highlights against the new DOM. Read the level via the state getter so this
  // listener effect needn't list `level` in its deps (which would re-subscribe on
  // every zoom step).
  useEffect(() => {
    if (!webview) return;
    const reapply = () => applyZoomLevel(webview, webviewZoom.levels$.get()[productId] ?? 0);
    webview.addEventListener('dom-ready', reapply);
    webview.addEventListener('did-finish-load', reapply);
    return () => {
      webview.removeEventListener('dom-ready', reapply);
      webview.removeEventListener('did-finish-load', reapply);
    };
  }, [webview, productId]);
}
