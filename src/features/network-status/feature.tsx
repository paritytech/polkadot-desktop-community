import { createFeature } from '@/shared/feature';
import { topBarTrailingSlot } from '@/features/app-shell';

import { NetworkButton } from './ui/NetworkButton';

export const networkStatusFeature = createFeature({ name: 'network/status' });

// Order 1 places the button after the chat button (0) and before the profile button (Number.MAX_SAFE_INTEGER).
networkStatusFeature.inject(topBarTrailingSlot, {
  order: 0,
  render: () => <NetworkButton />,
});
