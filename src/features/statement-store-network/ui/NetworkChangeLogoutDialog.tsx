import { memo } from 'react';

import { AlertDialog } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

type Props = {
  open: boolean;
  onConfirm: VoidFunction;
  onCancel: VoidFunction;
};

export const NetworkChangeLogoutDialog = memo(({ open, onConfirm, onCancel }: Props) => {
  const { t } = useTranslation();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onCancel();
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{t('feature.statementStoreNetwork.changeNetworkDialog.title')}</AlertDialog.Title>
          <div className="text-sm text-fg-secondary">
            <AlertDialog.Description>
              {t('feature.statementStoreNetwork.changeNetworkDialog.description')}
            </AlertDialog.Description>
          </div>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel onClick={onCancel}>{t('common.action.cancel')}</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onConfirm}>
            {t('feature.statementStoreNetwork.changeNetworkDialog.confirm')}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
});

NetworkChangeLogoutDialog.displayName = 'NetworkChangeLogoutDialog';
