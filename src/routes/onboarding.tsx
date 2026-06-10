import { createFileRoute, redirect } from '@tanstack/react-router';

import { hydrateUserIdentity } from '@/domains/application';
import { userIdentity$ } from '@/domains/sso';
import { OnboardingScreen } from '@/features/onboarding';

export const Route = createFileRoute('/onboarding')({
  component: () => <OnboardingScreen />,
  // Block onboarding mount until identity hydration completes. Without
  // this, an already-paired user briefly hits /onboarding on cold start and
  // OnboardingScreen kicks off a spurious V2 handshake subscription before
  // the navigate-to-/dashboard effect fires.
  loader: async () => {
    await hydrateUserIdentity();
    if (userIdentity$.get() !== null) {
      redirect({ to: '/dashboard', throw: true });
    }
  },
});
