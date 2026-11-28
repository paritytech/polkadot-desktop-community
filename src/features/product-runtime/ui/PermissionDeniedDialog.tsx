import { cloneElement, memo } from 'react';

import { Button, Dialog } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { getPermissionMeta } from '@/widgets/Permission';

type Props = {
  permission: 'Camera' | 'Microphone';
  onOpenSettings: () => void | Promise<void>;
  onClose: VoidFunction;
};

export const PermissionDeniedDialog = memo(({ permission, onOpenSettings, onClose }: Props) => {
  const { t } = useTranslation();
  // getPermissionMeta returns `PermissionMetadata | undefined` (it is a `.find`), so guard it.
  const meta = getPermissionMeta(permission);
  const icon = meta ? cloneElement(meta.icon, { className: cnTw('size-10') }) : null;
  const keyBase = `feature.productRuntime.permissionDenied.${permission}`;

  const handleOpenSettings = async () => {
    await Promise.resolve(onOpenSettings());
    onClose();
  };

  return (
    <Dialog.Root open onOpenChange={open => !open && onClose()}>
      <Dialog.Content aria-describedby={undefined} showCloseButton={false} onInteractOutside={event => event.preventDefault()}>
        <div className="flex size-16 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">{icon}</div>

        <div className="flex w-full flex-col gap-2 py-1 text-start">
          <Dialog.Title>
            <span className="text-fg-primary">{t(`${keyBase}.title`)}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="text-base font-normal text-fg-primary">{t(`${keyBase}.description`)}</span>
          </Dialog.Description>
        </div>

        <div className="flex w-full gap-2">
          <Button type="button" horizontalSize="fill" onClick={onClose}>
            {t('common.action.cancel')}
          </Button>
          <Button type="button" variant="primary" horizontalSize="fill" onClick={() => void handleOpenSettings()}>
            {t('feature.productRuntime.permissionDenied.systemDeviceSettings')}
          </Button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
});

PermissionDeniedDialog.displayName = 'PermissionDeniedDialog';
