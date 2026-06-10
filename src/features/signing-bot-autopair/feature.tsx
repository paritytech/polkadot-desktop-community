import { createStore } from 'effector';

import { AUTOTEST_ENABLED } from '@/shared/autotest';
import { createFeature } from '@/shared/feature';
import { onboardingTopSlot } from '@/features/onboarding';

import { SigningBotPanel } from './ui/SigningBotPanel';

export const signingBotAutopairFeature = createFeature({
  name: 'autotest/signingBotAutopair',
  enable: createStore(AUTOTEST_ENABLED),
});

signingBotAutopairFeature.inject(onboardingTopSlot, ({ qrPayload, environmentId }) => (
  <SigningBotPanel qrPayload={qrPayload} environmentId={environmentId} />
));
