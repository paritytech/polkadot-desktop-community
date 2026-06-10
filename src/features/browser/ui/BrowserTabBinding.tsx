import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useRxState } from '@/shared/rxstate';
import { browserTabs } from '@/aggregates/browser-tabs';
import { recordNavigation, tabHistories$ } from '../state/history';
import { NEW_TAB, PRODUCT, newTabRef, productRef, toBrowserNavigation } from '../tabs/helpers';

// Invisible component mounted in the app-shell persistentSlot. Owns product + new-tab
// routing: maps the URL to a tab (creating it), consumes a new-tab in place when it
// becomes a product, and navigates when a product/new-tab tab is selected.
export const BrowserTabBinding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams({ strict: false });
  const [selectedId] = useRxState(browserTabs.selectedTabId$);
  const [tabs] = useRxState(browserTabs.tabs$);

  // Re-runs selection->route when the visible tab navigates in-product
  // (pushState / anchor → updateTabDeeplink). Hidden tabs aren't selected, so
  // they can't hijack the host route.
  const selectedTabDeeplink = tabs.find(t => t.id === selectedId)?.deeplink ?? null;

  // route -> selection (and materialization / transient consumption)
  useEffect(() => {
    const ref = productRef(location, params) ?? newTabRef(location, params);
    if (!ref) return;

    // Live read: the selection BEFORE this route change is processed is the "previous" tab.
    const prevId = browserTabs.selectedTabId$.get();
    const prev = browserTabs.tabs$.get().find(t => t.id === prevId);
    const alreadyOpen = browserTabs.tabs$.get().some(t => t.id === ref.id);

    if (prev?.type === NEW_TAB && ref.type === PRODUCT && !alreadyOpen) {
      browserTabs.replaceTabIdentifier(prev.id, ref, { persistable: true });
      browserTabs.replaceAliveTabId(prev.id, ref.id);
    } else {
      browserTabs.addTab(ref, { persistable: ref.type === PRODUCT });
      browserTabs.touchAliveTabId(ref.id);
    }
    browserTabs.updateTabDeeplink(ref.id, ref.deeplink);
    browserTabs.selectTab(ref.id);
    const key = browserTabs.findTabKey(browserTabs.tabs$.get(), ref.id);
    if (key) tabHistories$.set(histories => ({ ...histories, [key]: recordNavigation(histories[key], ref) }));
  }, [location, params]); // location/params drive this; previous selection read live

  // selection (and selected-tab in-product navigation) -> route
  useEffect(() => {
    if (selectedId === null) return;
    const tab = browserTabs.tabs$.get().find(t => t.id === selectedId);
    if (!tab || (tab.type !== PRODUCT && tab.type !== NEW_TAB)) return;
    const activeRef = productRef(location, params) ?? newTabRef(location, params);
    // Skip only if already on this tab and, for products, the URL route matches
    // its deeplink — so an in-product pushState still reaches the host route.
    if (activeRef?.id === tab.id && (tab.type !== PRODUCT || activeRef.deeplink === tab.deeplink)) return;
    void navigate(toBrowserNavigation(tab));
  }, [selectedId, selectedTabDeeplink]);

  return null;
};
