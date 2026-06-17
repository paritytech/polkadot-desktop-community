import { MessageCircle } from 'lucide-react';
import { useCallback } from 'react';

import { useTranslation } from '@/shared/translation';
import { useProductRooms } from '@/domains/chat';
import { useDisplayedProduct } from '@/domains/product';
import { MenuItem } from '@/features/product-actions-menu';
import { useOpenProductChatRoom } from '../hooks/useOpenProductChatRoom';
import { openProceedInChatDialog } from '../state/proceedInChatDialog';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const ProceedInChatMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const { data: persistedRooms } = useProductRooms(productId);
  const openChatRoom = useOpenProductChatRoom();

  const supportsChat = product?.executables.worker?.includes?.chat === true;

  const handleSelect = useCallback(() => {
    closeMenu();

    const existingRoom = persistedRooms.at(0);
    if (existingRoom) {
      openChatRoom(existingRoom.sessionId);
      return;
    }

    openProceedInChatDialog(productId);
  }, [closeMenu, persistedRooms, openChatRoom, productId]);

  if (!supportsChat) return null;

  return (
    <MenuItem
      icon={<MessageCircle className="size-4" aria-hidden />}
      label={t('feature.chat.proceedInChat.menuItem')}
      onSelect={handleSelect}
    />
  );
};
