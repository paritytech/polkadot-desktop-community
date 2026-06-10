import { useRead } from '@/shared/hooks';

import { type InteractedProduct, interactionUseCase } from './interaction';

const EMPTY: InteractedProduct[] = [];

export const useInteractedProducts = () => {
  return useRead(interactionUseCase.watchInteractedProducts, {
    params: {},
    defaultValue: EMPTY,
  });
};
