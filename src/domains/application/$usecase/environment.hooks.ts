import { useRead } from '@/shared/hooks';
import { environmentService } from '../environment';
import { type EnvironmentId } from '../environment/types';

import { environmentUseCase } from './environment';

// React adapter over the async `environmentUseCase` — returns `null` until the
// environment is assembled from Remote Config.
export function useEnvironment(id: EnvironmentId) {
  return useRead(environmentUseCase.getById, {
    params: id,
    defaultValue: null,
  });
}

export function useActiveEnvironment() {
  return useEnvironment(environmentService.getActiveId());
}
