import { Button } from '@novasamatech/tr-ui';
import { memo } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';

import { PermissionRequestAlertLayout } from './PermissionRequestAlertLayout';

type Props = {
  isOpen: boolean;
  productId: string;
  permission: string;
  onAllowAlways: VoidFunction;
  onAllowOnce: VoidFunction;
  onDeny: VoidFunction;
  /** Close without changing stored permission (Escape, close button). */
  onDismiss: VoidFunction;
};

export const DevicePermissionRequestDialog = memo(
  ({ isOpen, productId, permission, onAllowAlways, onAllowOnce, onDeny, onDismiss }: Props) => {
    const { t } = useTranslation();
    const label = t(`feature.productPermissions.permissionRequest.permission.${permission}`);

    return (
      <PermissionRequestAlertLayout
        open={isOpen}
        productId={productId}
        title={t('feature.productPermissions.permissionRequest.title', { label })}
        description={t(`feature.productPermissions.permissionRequest.reason.${permission}`)}
        footer={
          <>
            <div className="min-w-0 flex-1">
              <Button type="button" variant="outline" fullWidth onClick={onDeny}>
                {t('feature.productPermissions.permissionRequest.deny')}
              </Button>
            </div>
            <div className="min-w-0 flex-1">
              <Button type="button" variant="outline" fullWidth onClick={onAllowOnce}>
                {t('feature.productPermissions.permissionRequest.allowOnce')}
              </Button>
            </div>
            <div className="min-w-0 flex-1" data-testid={TEST_IDS.permissionDialogAllowAlways}>
              <Button type="button" variant="default" fullWidth onClick={onAllowAlways}>
                {t('feature.productPermissions.permissionRequest.allowAlways')}
              </Button>
            </div>
          </>
        }
        onOpenChange={open => {
          if (!open) onDismiss();
        }}
      />
    );
  },
);

DevicePermissionRequestDialog.displayName = 'DevicePermissionRequestDialog';
