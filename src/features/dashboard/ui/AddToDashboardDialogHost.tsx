import { useRxState } from '@/shared/rxstate';
import { useDisplayedProduct } from '@/domains/product';
import { addToDashboardDialogTarget, closeAddToDashboardDialog } from '../state/addToDashboardDialog';

import { FavoriteSizeSelectorModal } from './FavoriteSizeSelectorModal';

const HostInner = ({ productId }: { productId: string }) => {
  const { data: product } = useDisplayedProduct(productId);
  if (!product) return null;
  return <FavoriteSizeSelectorModal product={product} isOpen onClose={closeAddToDashboardDialog} />;
};

export const AddToDashboardDialogHost = () => {
  const [productId] = useRxState(addToDashboardDialogTarget);
  if (!productId) return null;
  return <HostInner productId={productId} />;
};
