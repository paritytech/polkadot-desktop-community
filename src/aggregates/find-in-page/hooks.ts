import { type FoundInPageEvent, type WebviewTag } from 'electron';
import { useEffect, useMemo } from 'react';

import { useRxState } from '@/shared/rxstate';

import { findInPage } from './state/sessions';
import { type FindSession } from './types';

const EMPTY_SESSION: FindSession = { visible: false, query: '', matches: 0, activeMatchOrdinal: 0, openSeq: 0 };

/** Selector for the find bar UI — the session for a single tab. */
export function useFindSession(tabId: string): FindSession {
  const [sessions] = useRxState(findInPage.sessions$);
  return useMemo(() => sessions[tabId] ?? EMPTY_SESSION, [sessions, tabId]);
}

/** Command bindings for the find bar UI, pre-scoped to a tab. */
export function useFindControls(tabId: string) {
  return useMemo(
    () => ({
      setQuery: (query: string) => findInPage.setQuery(tabId, query),
      next: () => findInPage.stepNext(tabId),
      prev: () => findInPage.stepPrev(tabId),
      close: () => findInPage.close(tabId),
    }),
    [tabId],
  );
}

/**
 * Drives Electron's native find on the webview element and pipes results back into
 * aggregate state. Lives as a hook (not a use case) because its input — the
 * `WebviewTag` element — is React/DOM-only; the Webview widget that owns the element
 * is the sole caller. Keeps DOM refs out of the aggregate state itself.
 */
export function useFindInPageExecutor(tabId: string, webview: WebviewTag | null): void {
  const [requests] = useRxState(findInPage.requests$);
  const request = requests[tabId] ?? null;

  // Run each dispatched command once. requests$ only changes when a command is
  // issued (seq bump) or cleared, so `request` identity is a safe trigger.
  useEffect(() => {
    if (!webview || !request) return;
    switch (request.mode) {
      case 'search':
        webview.findInPage(request.query);
        break;
      case 'next':
        webview.findInPage(request.query, { findNext: true, forward: true });
        break;
      case 'prev':
        webview.findInPage(request.query, { findNext: true, forward: false });
        break;
      case 'stop':
        webview.stopFindInPage('clearSelection');
        break;
    }
  }, [webview, request]);

  // Report match counts from the native event.
  useEffect(() => {
    if (!webview) return;
    const onFound = (event: FoundInPageEvent) => {
      findInPage.reportResult(tabId, {
        matches: event.result.matches,
        activeMatchOrdinal: event.result.activeMatchOrdinal,
      });
    };
    webview.addEventListener('found-in-page', onFound);
    return () => {
      webview.removeEventListener('found-in-page', onFound);
    };
  }, [webview, tabId]);

  // Navigation/reload drops the guest's native find state, so the active search
  // must be re-run against the new content — otherwise the overlay shows stale
  // counts (SPA in-page nav) or a stuck "0/0" with no highlights (reload).
  // `did-finish-load` covers full loads/reloads (and fires after content is ready,
  // so the re-search actually finds matches); `did-navigate-in-page` covers SPA
  // pushState/replaceState navigation, which products use and which never triggers
  // a load cycle.
  useEffect(() => {
    if (!webview) return;
    const onNavigation = () => findInPage.rehighlight(tabId);
    webview.addEventListener('did-finish-load', onNavigation);
    webview.addEventListener('did-navigate-in-page', onNavigation);
    return () => {
      webview.removeEventListener('did-finish-load', onNavigation);
      webview.removeEventListener('did-navigate-in-page', onNavigation);
    };
  }, [webview, tabId]);

  // Tab closed / webview torn down — drop the session so it doesn't leak.
  useEffect(() => {
    return () => findInPage.clear(tabId);
  }, [tabId]);
}
