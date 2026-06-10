import { Button, Dialog } from '@novasamatech/tr-ui';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { memo } from 'react';

import { useTranslation } from '@/shared/translation';

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'downloading' | 'ready-to-install' | 'error';

type UpdateStatusModalProps = {
  isOpen: boolean;
  onClose: VoidFunction;
  status: UpdateStatus;
  downloadProgress?: number;
  errorMessage?: string;
  onInstallNow?: VoidFunction;
  onNotNow?: VoidFunction;
};

export const UpdateStatusModal = memo(
  ({ isOpen, onClose, status, downloadProgress = 0, errorMessage, onInstallNow, onNotNow }: UpdateStatusModalProps) => {
    const { t } = useTranslation();

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        if (status === 'ready-to-install') {
          onNotNow?.();
        }
        onClose();
      }
    };

    return (
      <Dialog modal open={isOpen} onOpenChange={handleOpenChange}>
        <Dialog.Content>
          <div className="flex flex-col items-center gap-4 py-6">
            {status === 'checking' && (
              <>
                <Loader className="h-8 w-8 animate-spin text-text-secondary" />
                <p className="text-sm text-text-secondary">{t('feature.updateCheck.checking')}</p>
              </>
            )}

            {status === 'up-to-date' && (
              <>
                <CheckCircle className="text-text-positive h-8 w-8" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-primary">{t('feature.updateCheck.upToDate')}</p>
                  <p className="mt-1 text-xs text-text-secondary">{t('feature.updateCheck.upToDateHint')}</p>
                </div>
              </>
            )}

            {status === 'downloading' && (
              <div className="flex w-full flex-col gap-2 px-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-text-secondary">{t('feature.updateCheck.downloading')}</p>
                  <p className="text-sm font-medium text-text-primary">
                    {t('feature.updateCheck.downloadingPercent', { percent: Math.round(downloadProgress) })}
                  </p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-general-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'ready-to-install' && (
              <>
                <CheckCircle className="text-text-positive h-8 w-8" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-primary">{t('feature.updateCheck.readyToInstall')}</p>
                  <p className="mt-1 text-xs text-text-secondary">{t('feature.updateCheck.readyToInstallHint')}</p>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle className="text-text-negative h-8 w-8" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-primary">{t('feature.updateCheck.error')}</p>
                  <p className="mt-1 text-xs text-text-secondary">{errorMessage || t('feature.updateCheck.errorHint')}</p>
                </div>
              </>
            )}
          </div>

          <Dialog.Footer>
            {status === 'up-to-date' || status === 'error' ? (
              <Button fullWidth variant="outline" onClick={onClose}>
                {t('feature.updateCheck.close')}
              </Button>
            ) : status === 'ready-to-install' ? (
              <div className="flex w-full gap-2">
                <div className="flex-1">
                  <Button fullWidth variant="outline" onClick={onNotNow}>
                    {t('feature.updateCheck.notNow')}
                  </Button>
                </div>
                <div className="flex-1">
                  <Button fullWidth onClick={onInstallNow}>
                    {t('feature.updateCheck.installNow')}
                  </Button>
                </div>
              </div>
            ) : status === 'checking' || status === 'downloading' ? (
              <Button fullWidth variant="outline" onClick={onClose}>
                {t('feature.updateCheck.close')}
              </Button>
            ) : null}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    );
  },
);

UpdateStatusModal.displayName = 'UpdateStatusModal';
