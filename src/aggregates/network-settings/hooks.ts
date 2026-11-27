import { useRead } from '@/shared/hooks';
import { useRxState } from '@/shared/rxstate';
import { useEnvironment } from '@/domains/application';

import { peopleChainStatus$ } from './peopleChainStatus';
import { networkSettings } from './state/settings';
import { type PeopleChainStatus, type PeopleChainStatusResult } from './types';

const DEFAULT_STATUS: PeopleChainStatus = 'reconnecting';

export const usePeopleChainStatus = (): PeopleChainStatusResult => {
  const [settings] = useRxState(networkSettings.settings$);
  // Config is async — `environment` is null until Remote Config resolves.
  const { data: environment } = useEnvironment(settings.environmentId);

  // Pass the stable module-level `peopleChainStatus$` directly (not an inline
  // wrapper) so `useRead` dedups the subscription across all consumers sharing
  // the same chain (keyed by genesisHash) — one status listener + one connection
  // hold instead of one per mounted hook.
  const { data: status } = useRead(peopleChainStatus$, {
    params: environment?.peopleChain ?? null,
    defaultValue: DEFAULT_STATUS,
    key: c => c.genesisHash,
  });

  return { status };
};
