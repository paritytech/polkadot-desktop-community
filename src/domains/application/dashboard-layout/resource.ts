import { type ResultAsync } from 'neverthrow';

import { createStreamResource } from '@/shared/resource';

import { type MainDashboardLayoutSnapshot, dashboardLayoutDb } from './repository';
import { type DashboardCard, type DashboardLayout } from './types';

// Live snapshot of the main dashboard layout. A single liveQuery subscription
// (shareReplay + refCount) backs every consumer — the dashboard grid, the
// favorites menu, anything that reads the layout — instead of each opening its
// own subscription to the same row. Hooks bind here via `useRead`; the
// `dashboardLayouts` table is never touched from a hook directly.
export const mainDashboardLayoutResource = createStreamResource({
  key: () => 'main',
})
  .subscribe<MainDashboardLayoutSnapshot | null>(() => dashboardLayoutDb.subscribeToMain())
  .cache<MainDashboardLayoutSnapshot | null>({
    initial: null,
    map: (_, snapshot) => snapshot,
  })
  .build();

// Writes to the main layout. Co-located with the resource so every access to
// the `dashboardLayouts` table flows through this module; the resource's
// liveQuery re-emits after each write, keeping readers in sync. Consumed by
// hooks (and use cases) — never by reaching into `repository.ts` from a hook.
export function saveMainLayout(pages: DashboardCard[][], activePageIndex?: number): ResultAsync<DashboardLayout, Error> {
  return dashboardLayoutDb.saveMainPages(pages, activePageIndex);
}

export function saveMainActivePage(activePageIndex: number): ResultAsync<number, Error> {
  return dashboardLayoutDb.saveMainActivePageIndex(activePageIndex);
}
