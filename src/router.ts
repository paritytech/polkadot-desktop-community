import { createHashHistory, createRouter } from '@tanstack/react-router';

import { RouteErrorFallback } from '@/shared/components';

import { PageLoadingState } from './PageLoadingState';
import { routeTree } from './routeTree.gen';

export const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPendingComponent: PageLoadingState,
  defaultErrorComponent: RouteErrorFallback,
  pathParamsAllowedCharacters: [':'],
});

declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation requires interface
  interface Register {
    router: typeof router;
  }
}
