import { Button, Dialog, toastError, toastWithAction } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { Loader } from 'lucide-react';
import { memo, useCallback, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { productChatService, useCreateProductRoom, useCurrentUserPeer, useProductRooms } from '@/domains/chat';
import { useDisplayedProduct } from '@/domains/product';
import { ProductDialogHeader } from '@/widgets/ProductDialogHeader';

type Props = {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogInner = ({ productId, onClose }: { productId: string; onClose: VoidFunction }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: product } = useDisplayedProduct(productId);
  const { data: peer } = useCurrentUserPeer();
  const { data: rooms } = useProductRooms(productId);
  const { run, pending } = useCreateProductRoom();
  const [submitting, setSubmitting] = useState(false);

  const name = product?.displayName ?? productId;
  const isPending = pending || submitting;
  // The product's first chat room (worker-declared). Null until its rooms load.
  const roomId = rooms.at(0)?.roomId ?? null;

  const handleConfirm = useCallback(() => {
    if (!peer || isPending || !roomId) return;

    const userId = peer.accountId;
    const observable = run({ roomId, userId, productId });

    setSubmitting(true);
    observable.subscribe({
      next: result => {
        if (!result) {
          toastError({ title: t('feature.chat.proceedInChat.toast.errorTitle') });
          setSubmitting(false);
          return;
        }
        const sessionId = productChatService.getSessionId(productId, roomId, userId);
        const title =
          result.status === 'Exists'
            ? t('feature.chat.proceedInChat.toast.existsTitle', { name })
            : t('feature.chat.proceedInChat.toast.successTitle', { name });
        onClose();
        toastWithAction({
          title,
          action: {
            label: t('feature.chat.proceedInChat.toast.openChat'),
            onClick: () => navigate({ to: '/chat/{-$chatId}', params: { chatId: sessionId } }),
          },
        });
      },
      error: () => {
        toastError({ title: t('feature.chat.proceedInChat.toast.errorTitle') });
        setSubmitting(false);
      },
      complete: () => setSubmitting(false),
    });
  }, [peer, isPending, roomId, run, productId, name, onClose, navigate, t]);

  return (
    <Dialog.Content aria-describedby={undefined} variant="default">
      <ProductDialogHeader product={product} />

      <div className="flex flex-col gap-2 py-6">
        <Dialog.Title>
          <span className="text-2xl leading-8 font-semibold text-fg-primary">{t('feature.chat.proceedInChat.dialog.title')}</span>
        </Dialog.Title>
        <Dialog.Description>
          <span className="text-base leading-6 font-normal text-fg-primary">
            {t('feature.chat.proceedInChat.dialog.description')}
          </span>
        </Dialog.Description>
      </div>

      <div className="flex w-full gap-2">
        <Button variant="outline" fullWidth disabled={isPending} onClick={onClose}>
          {t('common.action.cancel')}
        </Button>
        <Button
          data-testid={TEST_IDS.proceedInChatDialogConfirmButton}
          fullWidth
          disabled={isPending || !peer || !roomId}
          onClick={handleConfirm}
        >
          {isPending && <Loader className="h-4 w-4 animate-spin" />}
          {t('feature.chat.proceedInChat.dialog.confirm')}
        </Button>
      </div>
    </Dialog.Content>
  );
};

export const ProceedInChatDialog = memo(({ productId, open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    {open ? <DialogInner productId={productId} onClose={() => onOpenChange(false)} /> : null}
  </Dialog>
));

ProceedInChatDialog.displayName = 'ProceedInChatDialog';
