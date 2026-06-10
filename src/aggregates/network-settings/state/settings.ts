import { createState, persistLocalStorage } from '@/shared/rxstate';
import {
  type EnvironmentId,
  SETTINGS_STORAGE_KEY,
  environmentService,
  resetPersistedStateToDefaultEnvironment,
} from '@/domains/application';

type Settings = {
  environmentId: EnvironmentId;
};

const setValue = <T extends keyof Settings>(key: T, value: Settings[T]) => {
  return settings$.set(prev => ({ ...prev, [key]: value }));
};

// Must run before `persistLocalStorage` below — older builds persisted a
// different shape (0.3.x: `{ endpointMode: ... }`) under the same key, and the
// sync read inside `persistLocalStorage` would otherwise rehydrate state with
// missing/unknown `environmentId`, crashing downstream consumers
// (`environmentService.getById(...)` returns undefined). Cannot live in
// `bootstrap()` because top-level imports run first.
resetPersistedStateToDefaultEnvironment();

const settings$ = createState<Settings>({ environmentId: environmentService.getActiveId() });

persistLocalStorage(settings$, { key: SETTINGS_STORAGE_KEY });

export const networkSettings = {
  settings$,
  setValue,
};
