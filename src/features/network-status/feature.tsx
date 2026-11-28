import { createFeature } from '@/shared/feature';
import { topBarTrailingSlot } from '@/features/app-shell';

import { NetworkButton } from './ui/NetworkButton';

export const networkStatusFeature = createFeature({ name: 'network/status' });

networkStatusFeature.inject(topBarTrailingSlot, {
  order: 0,
  render: () => <NetworkButton />,
});
