import { useEffect, useRef } from 'react';

import { reloadApp } from '@/shared/env';
import { removeLocalStorageKeysByPrefix } from '@/shared/utils';

export type ResetAppDataExtraCleanup = () => Promise<void> | void;

/**
 * Listens for the main-process "reset-app-data" IPC event and wipes all
 * client-side state before reloading the renderer.
 *
 * `extraCleanup` runs *before* the synchronous storage purges below — pass
 * cleanup for state the `polkadot_*` localStorage sweep doesn't cover
 * (reactive in-memory state, IndexedDB-backed repos, etc.). The hook awaits it
 * before continuing so the reload doesn't race with async cleanup.
 */
export const useResetAppData = (extraCleanup?: ResetAppDataExtraCleanup) => {
  const cleanupRef = useRef<ResetAppDataExtraCleanup | undefined>(extraCleanup);
  cleanupRef.current = extraCleanup;

  useEffect(() => {
    const cleanup = window.App?.onResetAppData(async () => {
      try {
        await cleanupRef.current?.();
      } catch (err) {
        console.error('useResetAppData: extra cleanup failed', err);
      }

      // Clear all polkadot_* keys from localStorage
      removeLocalStorageKeysByPrefix('polkadot_');

      // Clear browser tabs
      localStorage.removeItem('browser_tabs_v1');

      // Clear IndexedDB databases — enumerate at runtime so new domain
      // databases (chat, contact, permissions, etc.) get wiped automatically
      // without having to keep this hook in sync with every repository.
      // The previous hard-coded list missed `p2p-chat`, `contact`, etc.,
      // which left stale chat rooms and a stale contact roster behind after
      // a "reset app data" and could keep the V2 chat manager pointing at
      // pre-reset peers.
      try {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .map(db => db.name)
            .filter((name): name is string => Boolean(name))
            .map(
              name =>
                new Promise<void>(resolve => {
                  const req = indexedDB.deleteDatabase(name);
                  req.onsuccess = () => resolve();
                  req.onerror = () => resolve();
                  req.onblocked = () => resolve();
                }),
            ),
        );
      } catch (err) {
        console.error('useResetAppData: failed to enumerate/delete IndexedDB databases', err);
      }

      // Wipe persisted offline archives from the main-process disk store.
      void window.App?.clearAllArchives?.();

      // Reset hash route so the app starts at root and redirects to onboarding
      location.hash = '#/';
      reloadApp();
    });

    return () => {
      cleanup?.removeAllListeners?.('reset-app-data');
    };
  }, []);
};
