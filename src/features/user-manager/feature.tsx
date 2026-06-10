import { createFeature } from '@/shared/feature';
import { topBarTrailingSlot } from '@/features/app-shell';

import { UserButton } from './ui/UserButton';

export const userManagerFeature = createFeature({
  name: 'user/manager',
});

userManagerFeature.inject(topBarTrailingSlot, {
  order: Number.MAX_SAFE_INTEGER,
  render: () => <UserButton />,
});
