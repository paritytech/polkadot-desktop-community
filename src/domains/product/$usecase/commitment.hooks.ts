import { useAction } from '@/shared/hooks';

import { commitmentUseCase } from './commitment';

export const usePinProduct = () => useAction(commitmentUseCase.pinProduct);
export const useUnpinProduct = () => useAction(commitmentUseCase.unpinProduct);
