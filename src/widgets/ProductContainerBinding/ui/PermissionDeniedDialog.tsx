import { Dialog } from '@novasamatech/tr-ui';
import { type PropsWithChildren, cloneElement, memo } from 'react';

import { useTranslation } from '@/shared/translation';
import { getPermissionMeta } from '@/widgets/Permission';

import { hasPermissionDeniedCopy, toPermissionDeniedKey, toPermissionMetaId } from './permissionDeniedDialogUtils';

type Props = {
  permission: string;
  /** Product/DB-level denial → in-app settings; OS-level (camera/mic) → system privacy. */
  deniedAt: 'app' | 'system';
  onOpenPrimarySettings: () => void | Promise<void>;
  onClose: VoidFunction;
};

const PermissionIcon = ({ children }: PropsWithChildren) => (
  <div className="flex size-16 items-center justify-center rounded-xl bg-bg-illustration-light text-fg-primary">{children}</div>
);

export const PermissionDeniedDialog = memo(({ permission, deniedAt, onOpenPrimarySettings, onClose }: Props) => {
  const { t } = useTranslation();
  const deniedKey = toPermissionDeniedKey(permission);
  const metaId = toPermissionMetaId(permission);
  const meta = metaId ? getPermissionMeta(metaId) : undefined;
  const icon = meta ? cloneElement(meta.icon, { size: 40 }) : null;
  const keyBase = hasPermissionDeniedCopy(permission)
    ? `widget.productContainerBinding.permissionDenied.${deniedKey}`
    : 'widget.productContainerBinding.permissionDenied.fallback';

  const primarySettingsLabel =
    deniedAt === 'system'
      ? t('widget.productContainerBinding.permissionDenied.systemDeviceSettings')
      : t('widget.productContainerBinding.permissionDenied.appSettings');

  const handlePrimarySettings = async () => {
    await Promise.resolve(onOpenPrimarySettings());
    onClose();
  };

  const handleInteractOutside = (event: { preventDefault: () => void }) => {
    event.preventDefault();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <Dialog.Content
        aria-describedby={undefined}
        variant="default"
        showCloseButton={false}
        onInteractOutside={handleInteractOutside}
      >
        <PermissionIcon>{icon}</PermissionIcon>

        <div className="flex w-full flex-col gap-2 py-1 text-left">
          <Dialog.Title>
            <span className="text-2xl leading-8 font-semibold text-fg-primary">{t(`${keyBase}.title`)}</span>
          </Dialog.Title>
          <Dialog.Description>
            <span className="text-base leading-6 font-normal text-fg-primary">{t(`${keyBase}.description`)}</span>
          </Dialog.Description>
        </div>

        <div className="flex w-full gap-2">
          <button
            type="button"
            className="flex h-9 min-h-9 flex-1 items-center justify-center rounded-lg border border-border-primary bg-bg-action-primary-inverted px-4 py-1 text-base leading-6 font-medium text-fg-primary hover:bg-bg-action-primary-inverted-hover focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
            onClick={onClose}
          >
            {t('common.action.cancel')}
          </button>
          <button
            type="button"
            className="flex h-9 min-h-9 flex-1 items-center justify-center rounded-lg bg-bg-action-primary px-4 py-1 text-base leading-6 font-medium text-fg-primary-inverted hover:bg-bg-action-primary-hover focus-visible:ring-[4px] focus-visible:ring-border-tertiary/35 focus-visible:ring-offset-0 focus-visible:outline-none"
            onClick={() => void handlePrimarySettings()}
          >
            {primarySettingsLabel}
          </button>
        </div>
      </Dialog.Content>
    </Dialog>
  );
});

PermissionDeniedDialog.displayName = 'PermissionDeniedDialog';
