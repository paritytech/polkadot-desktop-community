import { createFeature } from '@/shared/feature';
import { persistentSlot } from '@/features/app-shell';

import { WorkersManager } from './ui/WorkersManager';

export const productWorkerFeature = createFeature({
  name: 'product/worker',
});

productWorkerFeature.inject(persistentSlot, () => <WorkersManager />);
