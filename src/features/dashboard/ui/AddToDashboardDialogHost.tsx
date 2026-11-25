import { useEffect } from 'react';

import { toast } from '@/shared/components';
import { useTransformer } from '@/shared/di';
import { useRxState } from '@/shared/rxstate';
import { useTranslation } from '@/shared/translation';
import { addToDashboardModalTransformer } from '../di';
import { addToDashboardDialogTarget, closeAddToDashboardDialog } from '../state/addToDashboardDialog';

// `targetId` is a product baseName for chain products, or a native addable
// entry's grid id (e.g. chat) — the dialog opens for both kinds. The host stays
// content-agnostic: content providers register modal handlers against
// `addToDashboardModalTransformer`, and the first non-null node wins.
const HostInner = ({ targetId }: { targetId: string }) => {
  const { t } = useTranslation();
  const node = useTransformer(addToDashboardModalTransformer, { targetId, onClose: closeAddToDashboardDialog });

  // No provider claimed this target — surface it instead of failing silently,
  // and close the dialog so it can't get stuck open with nothing rendered.
  useEffect(() => {
    if (node) return;
    toast.error({ title: t('feature.dashboard.addToDashboard.toast.targetUnresolved') });
    closeAddToDashboardDialog();
  }, [node, t]);

  return node ?? null;
};

export const AddToDashboardDialogHost = () => {
  const [targetId] = useRxState(addToDashboardDialogTarget);
  if (!targetId) return null;
  return <HostInner targetId={targetId} />;
};
