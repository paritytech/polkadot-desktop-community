import { Pin } from 'lucide-react';

import { TEST_IDS } from '@/shared/test-ids';
import { useIsPinned } from '@/domains/product';

type Props = {
  productId: string;
};

export const PinIndicator = ({ productId }: Props) => {
  const pinned = useIsPinned(productId);
  if (!pinned) return null;

  return <Pin data-testid={TEST_IDS.offlineAccessPinIndicator} className="size-3.5 shrink-0 text-text-secondary" aria-hidden />;
};
