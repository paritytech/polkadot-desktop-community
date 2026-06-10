import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/')({
  loader: () => {
    redirect({
      to: '/settings/appearance',
      throw: true,
    });
  },
});
