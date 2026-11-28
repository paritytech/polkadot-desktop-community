import { useCallback } from 'react';

import { toast } from '@/shared/components';
import { MessageCircleIcon } from '@/shared/icons';
import { useTranslation } from '@/shared/translation';
import { useProductRooms } from '@/domains/chat';
import { useCommitProductByIdentifier, useDisplayedProduct } from '@/domains/product';
import { useTruapiUserId } from '@/aggregates/truapi-runtime';
import { MenuItem } from '@/features/product-actions-menu';
import { useOpenChatTab } from '../hooks/useOpenChatTab';
import { useOpenProductChatRoom } from '../hooks/useOpenProductChatRoom';

type Props = {
  productId: string;
  closeMenu: VoidFunction;
};

export const ProceedInChatMenuItem = ({ productId, closeMenu }: Props) => {
  const { t } = useTranslation();
  const { data: product } = useDisplayedProduct(productId);
  const { data: persistedRooms } = useProductRooms(productId, useTruapiUserId());
  const openChatRoom = useOpenProductChatRoom();
  const openChatTab = useOpenChatTab();
  const { run: commitProduct } = useCommitProductByIdentifier();

  const supportsChat = product?.executables.worker?.includes?.chat === true;

  const handleSelect = useCallback(() => {
    closeMenu();

    const existingRoom = persistedRooms.at(0);
    if (existingRoom) {
      openChatRoom(existingRoom.sessionId);

      return;
    }

    // Navigate first: committing is a chain round-trip, and the room only appears
    // once the product's worker has booted and declared it. The roomId belongs to
    // the worker, so the host cannot create the room itself — committing is what
    // makes WorkersManager mount that worker.
    openChatTab();

    const failed = () => toast.error({ title: t('feature.chat.proceedInChat.toast.errorTitle') });

    commitProduct(productId).subscribe({
      next: committed => {
        if (!committed) failed();
      },
      error: failed,
    });
  }, [closeMenu, persistedRooms, openChatRoom, openChatTab, commitProduct, productId, t]);

  if (!supportsChat) return null;

  return (
    <MenuItem
      icon={<MessageCircleIcon className="size-4" />}
      label={t('feature.chat.proceedInChat.menuItem')}
      onSelect={handleSelect}
    />
  );
};
