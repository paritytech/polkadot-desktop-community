import { createSlot } from '@/shared/di';
import { type EnvironmentId } from '@/domains/application';

type OnboardingTopSlotProps = {
  qrPayload: string | null;
  environmentId: EnvironmentId;
};

export const onboardingTopSlot = createSlot<OnboardingTopSlotProps>({ name: 'onboardingTopSlot' });
