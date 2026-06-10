import { type PappAdapter } from '@novasamatech/host-papp';
import { useEffect, useSyncExternalStore } from 'react';

import { ensurePappProvider, getPappProvider, subscribePappProvider } from './provider';

export const usePappProvider = (): PappAdapter | null => {
  // Kick off lazy creation of the singleton adapter (idempotent).
  useEffect(() => {
    void ensurePappProvider();
  }, []);

  // Standard external-store shape: `getPappProvider` is the synchronous
  // snapshot, `subscribePappProvider` the change notifier (cf. `useHandshakeV2`).
  return useSyncExternalStore(subscribePappProvider, getPappProvider);
};
