import { Button } from '@novasamatech/tr-ui';
import { ArrowDownCircle, Loader, XCircle } from 'lucide-react';
import { memo } from 'react';

import { useTranslation } from '@/shared/translation';

export type ToastStatus = 'ready' | 'installing' | 'error';

type UpdateToastProps = {
  version: string;
  visible: boolean;
  status: ToastStatus;
  onDismiss: VoidFunction;
  onInstall: VoidFunction;
};

export const UpdateToast = memo(({ version, visible, status, onDismiss, onInstall }: UpdateToastProps) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 rounded-xl border border-general-border bg-bg-surface-container p-4 shadow-lg duration-200 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        {status === 'error' ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-fg-error" />
        ) : (
          <ArrowDownCircle className="mt-0.5 h-5 w-5 shrink-0 text-fg-success" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg-primary">
            {status === 'error' ? t('feature.updateCheck.installFailed') : t('feature.updateCheck.updateAvailable')}
          </p>
          <p className="mt-0.5 text-xs text-fg-tertiary">
            {status === 'error'
              ? t('feature.updateCheck.installFailedHint')
              : t('feature.updateCheck.updateAvailableHint', { version })}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>
          {t('feature.updateCheck.dismiss')}
        </Button>
        {status !== 'error' && (
          <Button size="sm" disabled={status === 'installing'} onClick={onInstall}>
            {status === 'installing' && <Loader className="h-3.5 w-3.5 animate-spin" />}
            {t('feature.updateCheck.install')}
          </Button>
        )}
      </div>
    </div>
  );
});

UpdateToast.displayName = 'UpdateToast';
