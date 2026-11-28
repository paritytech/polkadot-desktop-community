import { type ErrorComponentProps } from '@tanstack/react-router';
import { useEffect } from 'react';

import { isElectron } from '@/shared/env';
import { DownloadIcon, OctagonXIcon, RefreshCwIcon } from '@/shared/icons';
import { Sentry } from '@/shared/sentry';
import { useTranslation } from '@/shared/translation';
import { Button } from '../Button/Button';

export const RouteErrorFallback = ({ error, info, reset }: ErrorComponentProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
  }, [error, info]);

  const handleDownloadLogs = () => {
    window.App?.exportLogs();
  };

  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-lg bg-bg-surface-main p-12">
      <div className="flex flex-col items-center gap-2 self-stretch">
        <div className="flex flex-col items-center justify-center pb-4">
          <OctagonXIcon className="h-8 w-8 text-fg-primary" strokeWidth={1} />
        </div>
        <h1 className="w-full text-center text-base font-medium text-fg-primary">{t('common.error.somethingWentWrong')}</h1>
        <p className="w-full text-center text-sm font-normal text-fg-secondary">{t('common.error.tryAgain')}</p>
        {isElectron() && (
          <p className="w-full text-center text-xs font-normal text-fg-tertiary">{t('common.error.logsHelpText')}</p>
        )}
      </div>
      <div className="flex flex-col items-center gap-4 self-stretch" style={{ appRegion: 'no-drag' }}>
        <Button onClick={reset}>
          <RefreshCwIcon className="h-4 w-4" />
          {t('common.action.retry')}
        </Button>
        {isElectron() && (
          <Button variant="ghost" onClick={handleDownloadLogs}>
            <DownloadIcon className="h-4 w-4" />
            {t('common.action.downloadLogs')}
          </Button>
        )}
      </div>
    </main>
  );
};
