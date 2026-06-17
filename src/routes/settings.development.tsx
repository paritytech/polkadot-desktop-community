import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { isProductionBuild } from '@/shared/env';

// The whole Settings → Development section is unreachable in
// production builds. Guarding the parent covers every child route.
export const Route = createFileRoute('/settings/development')({
  beforeLoad: () => {
    if (isProductionBuild()) {
      redirect({ to: '/settings', throw: true });
    }
  },
  component: Outlet,
});
