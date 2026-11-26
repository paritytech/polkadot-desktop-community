import { useEffect, useState } from 'react';

import { useAction, useRead } from '@/shared/hooks';
import { ensureLightClient, hasLightClientSupport } from '../api/lightClient';
import { type GenesisHash } from '../chain/types';

import {
  INITIAL_CONNECTION_SETTINGS,
  connectionSettingsResource,
  setChainConnectionMode,
  setConnectionPreference,
} from './resource';
import { connectionService } from './service';
import { type ChainConnectionMode } from './types';

export const useConnectionSettings = () => {
  return useRead(connectionSettingsResource, {
    params: {},
    defaultValue: INITIAL_CONNECTION_SETTINGS,
  });
};

// Boot loads the light client only when a network could use it, so a screen that
// renders availability asks for it here — `hasLightClientSupport` reads module
// state and emits nothing, hence the `ready` flag to re-render on.
const useLightClientReady = (): boolean => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    ensureLightClient()
      .catch((error: unknown) => {
        console.error('[network] light client unavailable — every network shows RPC only', error);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return ready;
};

export const useChainConnectionMode = (chainId: GenesisHash): ChainConnectionMode => {
  const { data: settings } = useConnectionSettings();
  // Read for its re-render, not its value: availability is resolved below.
  useLightClientReady();

  return connectionService.describeChainMode(settings, chainId, hasLightClientSupport(chainId));
};

export const useSetConnectionPreference = () => useAction(setConnectionPreference);

export const useSetChainConnectionMode = () => useAction(setChainConnectionMode);
