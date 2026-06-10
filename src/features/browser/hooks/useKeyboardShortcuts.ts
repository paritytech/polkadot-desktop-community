import { useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

import { isElectron } from '@/shared/env';
import { findInPage } from '@/aggregates/find-in-page';
import { onProductRefreshRequestedSideEffect } from '@/aggregates/product-loading';
import { webviewZoom } from '@/aggregates/webview-zoom';
import { focusAddressBarSideEffect, productAddToDashboardSideEffect } from '../di';
import { PRODUCT } from '../tabs/helpers';

import { useTabHistoryNavigation } from './useTabHistoryNavigation';
import { useTabs } from './useTabs';

export const useKeyboardShortcuts = () => {
  const { tabs, selectedTabId, select, closeTab } = useTabs();
  const selected = tabs.find(t => t.id === selectedTabId) ?? null;
  const { goBack, goForward } = useTabHistoryNavigation();
  // Browser (and this hook) stays mounted on every route, only hidden off product
  // routes. Find-in-page must act only when a product is actually on screen — the
  // selected tab can be a product even while the dashboard/chat/settings route is
  // shown, and a new-tab selection has no webview/overlay at all.
  const { pathname } = useLocation();
  // The on-screen product tab — the shared target for both find-in-page and zoom.
  const productTarget = pathname.startsWith('/product/') && selected?.type === PRODUCT ? selected : null;

  // Cmd/Ctrl+K — focuses the address bar from any route, in both web and Electron.
  // Registered once at the browser-feature level; only the listening AddressBar instance reacts.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        void focusAddressBarSideEffect.apply({});
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reflect product-on-screen presence into the Electron menus so the Edit → Find /
  // Find Next / Find Previous and View → Zoom In / Zoom Out / Actual Size items are
  // visibly disabled (greyed out) off product routes. Without this, those menu items
  // click into a renderer no-op — a dead end with no UX feedback. Disabling them also
  // means their accelerators don't fire against a stale on-screen product.
  const productOnScreen = !!productTarget;
  useEffect(() => {
    if (!isElectron()) return;
    window.App.setFindMenuEnabled(productOnScreen);
    window.App.setZoomMenuEnabled(productOnScreen);
    window.App.setProductDashboardMenuEnabled(productOnScreen);
    return () => {
      window.App.setFindMenuEnabled(false);
      window.App.setZoomMenuEnabled(false);
      window.App.setProductDashboardMenuEnabled(false);
    };
  }, [productOnScreen]);

  useEffect(() => {
    const focusAddressBar = () => {
      void focusAddressBarSideEffect.apply({});
    };

    const reloadWebview = () => {
      if (selected) {
        void onProductRefreshRequestedSideEffect.apply({ identifier: selected.id });
      }
    };

    const closeCurrentTab = () => {
      if (selected) {
        closeTab(selected);
      } else if (isElectron()) {
        window.App.closeWindow();
      }
    };

    const nextTab = () => {
      if (tabs.length === 0) return;
      if (!selected) {
        select(tabs[0]!);
        return;
      }
      const idx = tabs.findIndex(t => t.id === selected.id);
      const next = tabs[(idx + 1) % tabs.length];
      if (next) select(next);
    };

    const prevTab = () => {
      if (tabs.length === 0) return;
      if (!selected) {
        select(tabs[tabs.length - 1]!);
        return;
      }
      const idx = tabs.findIndex(t => t.id === selected.id);
      const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
      if (prev) select(prev);
    };

    const gotoTab = (index: number) => {
      if (index === 8) {
        // Cmd+9 goes to last tab
        const last = tabs[tabs.length - 1];
        if (last) select(last);
      } else if (tabs[index]) {
        select(tabs[index]);
      }
    };

    const newTab = () => {
      void focusAddressBarSideEffect.apply({ newTab: true });
    };

    // Find-in-page targets the on-screen product tab. The menu accelerator (not a
    // DOM listener) is the reliable Cmd+F path: it fires even when focus is inside
    // the guest webview, where host keydown events never arrive. Guarding on
    // productTarget keeps Cmd+F a no-op (and leaves it to the OS) off product routes,
    // and avoids creating orphan sessions for tabs that have no overlay/executor.
    const openFind = () => {
      if (productTarget) findInPage.open(productTarget.id);
    };

    const findNext = () => {
      if (productTarget) findInPage.stepNext(productTarget.id);
    };

    const findPrevious = () => {
      if (productTarget) findInPage.stepPrev(productTarget.id);
    };

    // Zoom targets the same on-screen product tab. The menu accelerator fires even
    // when focus is inside the guest webview, where host keydown never arrives.
    const zoomIn = () => {
      if (productTarget) webviewZoom.zoomIn(productTarget.id);
    };

    const zoomOut = () => {
      if (productTarget) webviewZoom.zoomOut(productTarget.id);
    };

    const zoomReset = () => {
      if (productTarget) webviewZoom.reset(productTarget.id);
    };

    // Cmd/Ctrl+D — Add to Dashboard or toggle Favorites (same as the product actions menu).
    // Menu accelerator is the reliable path when focus is inside the guest webview.
    const addToDashboard = () => {
      if (!productTarget) return;
      void productAddToDashboardSideEffect.apply({ productId: productTarget.id });
    };

    if (isElectron()) {
      const cleanups = [
        window.App.onNavigateHistoryBack(goBack),
        window.App.onNavigateHistoryForward(goForward),
        window.App.onWebviewReload(reloadWebview),
        window.App.onTabClose(closeCurrentTab),
        window.App.onTabNew(newTab),
        window.App.onAddressBarFocus(focusAddressBar),
        window.App.onTabNext(nextTab),
        window.App.onTabPrev(prevTab),
        window.App.onTabGoto(gotoTab),
        window.App.onFind(openFind),
        window.App.onFindNext(findNext),
        window.App.onFindPrevious(findPrevious),
        window.App.onZoomIn(zoomIn),
        window.App.onZoomOut(zoomOut),
        window.App.onZoomReset(zoomReset),
        window.App.onProductAddToDashboard(addToDashboard),
      ];

      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    }

    // Web mode: keydown listener
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 't') {
        e.preventDefault();
        newTab();
        return;
      }

      if (mod && e.key === 'w') {
        e.preventDefault();
        closeCurrentTab();
        return;
      }

      if (mod && e.key === 'r') {
        e.preventDefault();
        reloadWebview();
        return;
      }

      if (mod && e.key === 'l') {
        e.preventDefault();
        focusAddressBar();
        return;
      }

      if (mod && e.key === '[') {
        e.preventDefault();
        goBack();
        return;
      }

      if (mod && e.key === ']') {
        e.preventDefault();
        goForward();
        return;
      }

      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          prevTab();
        } else {
          nextTab();
        }
        return;
      }

      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        gotoTab(Number(e.key) - 1);
        return;
      }

      if (mod && e.key === 'd') {
        e.preventDefault();
        addToDashboard();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabs, selectedTabId, select, closeTab, goBack, goForward, productTarget]);
};
