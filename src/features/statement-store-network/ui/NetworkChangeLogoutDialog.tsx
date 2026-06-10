import { AlertDialog } from '@novasamatech/tr-ui';
import { memo } from 'react';

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
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{t('feature.statementStoreNetwork.changeNetworkDialog.title')}</AlertDialog.Title>
          <div className="text-sm text-text-secondary">
            <AlertDialog.Description>
              {t('feature.statementStoreNetwork.changeNetworkDialog.description')}
            </AlertDialog.Description>
          </div>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <div className="flex w-full gap-2 p-1">
            <AlertDialog.Cancel fullWidth onClick={onCancel}>
              {t('common.action.cancel')}
            </AlertDialog.Cancel>
            <AlertDialog.Action fullWidth onClick={onConfirm}>
              {t('feature.statementStoreNetwork.changeNetworkDialog.confirm')}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
});

NetworkChangeLogoutDialog.displayName = 'NetworkChangeLogoutDialog';
