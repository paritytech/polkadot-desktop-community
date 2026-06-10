import { useCallback } from 'react';

import { useAction } from '@/shared/hooks';

import { productManagementUseCase } from './productManagementUseCase';

// The use case method is already a stable reference and returns the Promise the
// add-widget panel's `onSelectProduct` expects. No `useAction` here: the caller
// consumes the returned `{ ok, pageIndex }` inline and owns its own toasts.
export const useAddProductToDashboard = () => productManagementUseCase.addProductToDashboard;

export const useForgetProduct = () => {
  const { run, pending, status } = useAction(({ productId }: { productId: string }) =>
    productManagementUseCase.forgetProduct(productId),
  );

  const forgetProduct = useCallback((productId: string) => run({ productId }), [run]);

  return { forgetProduct, pending, status };
};
