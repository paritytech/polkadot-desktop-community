import { MessageCircle } from 'lucide-react';

import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';
import { MenuItem } from '@/features/product-actions-menu';
import { openProceedInChatDialog } from '../state/proceedInChatDialog';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const ProceedInChatMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const supportsChat = product?.executables.worker?.includes?.chat === true;

  if (!supportsChat) return null;

  return (
    <MenuItem
      icon={<MessageCircle className="size-4" aria-hidden />}
      label={t('feature.chat.proceedInChat.menuItem')}
      onSelect={() => {
        closeMenu();
        openProceedInChatDialog(productId);
      }}
    />
  );
};
