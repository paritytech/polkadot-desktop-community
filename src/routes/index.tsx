import { createFileRoute, redirect } from '@tanstack/react-router';

import { hydrateUserIdentity } from '@/domains/application';
import { userIdentity$ } from '@/domains/sso';

const Index = () => {
  return null;
};

export const Route = createFileRoute('/')({
  component: Index,
  // Await identity hydration before deciding the destination — otherwise a
  // user who is already paired briefly bounces through /onboarding (and starts
  // a spurious V2 handshake subscription) while bootstrap's hydration is in
  // flight. `hydrateUserIdentity` is idempotent so cold-start +
  // bootstrap's fire-and-forget call is fine.
  loader: async () => {
    await hydrateUserIdentity();
    redirect({
      to: userIdentity$.get() !== null ? '/dashboard' : '/onboarding',
      throw: true,
    });
  },
});
