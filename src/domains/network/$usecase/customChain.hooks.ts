import { useAction } from '@/shared/hooks';

import { customChainUseCase } from './customChain';

export const useDiscoverAndAddChain = () =>
  useAction(({ endpoint, name }: { endpoint: string; name: string }) => customChainUseCase.discoverAndAddChain(endpoint, name));
