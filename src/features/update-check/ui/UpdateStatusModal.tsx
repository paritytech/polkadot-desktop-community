import { type ReactNode, memo } from 'react';

import CircleCheckBigIcon from '@/shared/assets/images/icons/circle-check-big.svg?jsx';
import CircleExclamationPointIcon from '@/shared/assets/images/icons/circle-exclamation-point.svg?jsx';
import LoaderIcon from '@/shared/assets/images/icons/loader.svg?jsx';
import { Button, Dialog } from '@/shared/components';
import { useTranslation } from '@/shared/translation';

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready-to-install' | 'error' | 'unsupported';

type UpdateStatusModalProps = {
  isOpen: boolean;
  onClose: VoidFunction;
  status: UpdateStatus;
  downloadProgress?: number;
  currentVersion?: string;
  errorMessage?: string;
  onInstallNow?: VoidFunction;
  onNotNow?: VoidFunction;
};

export const UpdateStatusModal = memo(
  ({
    isOpen,
    onClose,
    status,
    downloadProgress = 0,
    currentVersion,
    errorMessage,
    onInstallNow,
    onNotNow,
  }: UpdateStatusModalProps) => {
    const { t } = useTranslation();

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        if (status === 'ready-to-install') {
          onNotNow?.();
        }
        onClose();
      }
    };

    let icon: ReactNode = null;
    let title = '';
    let description = '';

    switch (status) {
      case 'checking':
        icon = <LoaderIcon className="h-8 w-8 animate-spin text-fg-secondary" />;
        title = t('feature.updateCheck.checking');
        description = t('feature.updateCheck.checkingHint');
        break;
      case 'downloading':
        title = t('feature.updateCheck.downloading');
        description = t('feature.updateCheck.downloadingHint');
        break;
      case 'up-to-date':
        icon = <CircleCheckBigIcon className="h-8 w-8 text-fg-success" />;
        title = t('feature.updateCheck.upToDate');
        // Omit the version clause until the running version is known, to avoid "Version  installed".
        description = currentVersion
          ? t('feature.updateCheck.upToDateHint', { version: currentVersion })
          : t('feature.updateCheck.upToDateHintNoVersion');
        break;
      case 'ready-to-install':
        title = t('feature.updateCheck.readyToInstall');
        description = t('feature.updateCheck.readyToInstallHint');
        break;
      case 'error':
        icon = <CircleExclamationPointIcon className="h-8 w-8 text-fg-error" />;
        title = t('feature.updateCheck.error');
        description = errorMessage || t('feature.updateCheck.errorHint');
        break;
      case 'unsupported':
        icon = <CircleExclamationPointIcon className="h-8 w-8 text-fg-secondary" />;
        title = t('feature.updateCheck.unsupported');
        description = t('feature.updateCheck.unsupportedHint');
        break;
      default:
        break;
    }

    return (
      <Dialog.Root modal open={isOpen} onOpenChange={handleOpenChange}>
        <Dialog.Content>
          <Dialog.Header>
            {icon}
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </Dialog.Header>

          {status === 'downloading' && (
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-fg-secondary">{t('feature.updateCheck.progress')}</p>
                <p className="text-xs font-medium text-fg-primary">
                  {t('feature.updateCheck.downloadingPercent', { percent: Math.round(downloadProgress) })}
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-nested">
                <div
                  className="h-full rounded-full bg-fg-primary transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          <Dialog.Footer>
            {status === 'ready-to-install' ? (
              <div className="flex w-full gap-2">
                <div className="flex-1">
                  <Button horizontalSize="fill" onClick={onNotNow}>
                    {t('feature.updateCheck.notNow')}
                  </Button>
                </div>
                <div className="flex-1">
                  <Button variant="primary" horizontalSize="fill" onClick={onInstallNow}>
                    {t('feature.updateCheck.installNow')}
                  </Button>
                </div>
              </div>
            ) : status === 'up-to-date' || status === 'error' || status === 'unsupported' ? (
              <Button horizontalSize="fill" onClick={onClose}>
                {t('feature.updateCheck.close')}
              </Button>
            ) : null}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    );
  },
);

UpdateStatusModal.displayName = 'UpdateStatusModal';
