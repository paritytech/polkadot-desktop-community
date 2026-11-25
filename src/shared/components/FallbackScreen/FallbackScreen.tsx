import { Download, RefreshCw, XOctagon } from 'lucide-react';

import { isElectron, reloadApp } from '@/shared/env';
import { useTranslation } from '@/shared/translation';
import { Button } from '../Button/Button';

export const FallbackScreen = () => {
  const { t } = useTranslation();
  const handleRetry = () => {
    reloadApp();
  };

  const handleDownloadLogs = () => {
    window.App?.exportLogs();
  };

  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-lg bg-bg-surface-main p-12">
      <div className="flex flex-col items-center gap-2 self-stretch">
        <div className="flex flex-col items-center justify-center pb-4">
          <XOctagon className="h-8 w-8 text-fg-primary" strokeWidth={1} />
        </div>
        <h1 className="w-full text-center text-base leading-6 font-medium text-fg-primary">
          {t('common.error.somethingWentWrong')}
        </h1>
        <p className="w-full text-center text-sm leading-5 font-normal text-fg-secondary">{t('common.error.tryAgain')}</p>
        {isElectron() && (
          <p className="w-full text-center text-xs leading-4 font-normal text-fg-tertiary">{t('common.error.logsHelpText')}</p>
        )}
      </div>
      <div className="flex flex-col items-center gap-4 self-stretch" style={{ appRegion: 'no-drag' }}>
        <Button onClick={handleRetry}>
          <RefreshCw className="h-4 w-4" />
          {t('common.action.retry')}
        </Button>
        {isElectron() && (
          <Button variant="ghost" onClick={handleDownloadLogs}>
            <Download className="h-4 w-4" />
            {t('common.action.downloadLogs')}
          </Button>
        )}
      </div>
    </main>
  );
};
