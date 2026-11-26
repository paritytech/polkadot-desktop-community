import { firstValueFrom } from 'rxjs';

import { toast } from '@/shared/components';
import { useSideEffect } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import {
  type ExecutableKind,
  manifestService,
  onProductModalityOpenedSideEffect,
  updatesUseCase,
  useDeclineUpdate,
} from '@/domains/product';
import { openOfflineAccessDialog } from '../state/dialogState';

// Headless reactor: on a product-modality open, check that one modality for a
// newer-than-frozen, undeclined on-chain version and, if found, raise a
// persistent toast. Update opens the existing confirm dialog; dismissing the
// toast declines that exact version (contenthash). Mounted once via persistentSlot.
export const ModalityUpdateToaster = () => {
  const { t } = useTranslation();
  const { run: declineUpdate } = useDeclineUpdate();

  useSideEffect(onProductModalityOpenedSideEffect, async ({ productId, kind }: { productId: string; kind: ExecutableKind }) => {
    const update = await updatesUseCase.checkModalityUpdate({ baseName: productId, kind });
    if (!update) return;

    toast.message({
      title: t('feature.offlineAccess.toast.modalityUpdate.title', {
        modality: t(`feature.offlineAccess.section.modality.${kind}`),
      }),
      id: `modality-update:${productId}#${kind}`,
      description: t('feature.offlineAccess.toast.modalityUpdate.description', {
        version: manifestService.formatVersion(update.version),
      }),
      duration: Infinity,
      action: {
        label: t('feature.offlineAccess.toast.modalityUpdate.action'),
        onClick: () => openOfflineAccessDialog({ kind: 'updateExecutable', productId, executableKind: kind }),
      },
      onDismiss: () => {
        // Await the decline write so a rapid re-open re-check races a settled
        // record; the stable toast `id` de-dupes (replaces) any residual re-nag
        // into a single self-healing toast rather than a stack. The write now
        // sources the network TLD first, so it can reject — nothing to recover
        // beyond not leaving it unhandled; the toast simply re-nags next open.
        void firstValueFrom(
          declineUpdate({ baseName: productId, kind, contenthash: update.contenthash, version: update.version }),
        ).catch(() => {
          console.warn('[offline-access] could not record the declined update');
        });
      },
    });
  });

  return null;
};
