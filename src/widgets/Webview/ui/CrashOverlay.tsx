import OctagonXIcon from '@/shared/assets/images/icons/octagon-x.svg?jsx';
import RefreshCwIcon from '@/shared/assets/images/icons/refresh-cw.svg?jsx';
import { Button } from '@/shared/components';
import { isElectron } from '@/shared/env';
import { useTranslation } from '@/shared/translation';
import { type WebviewCrashInfo } from '@/aggregates/webview-registry';

type Props = {
  crash: WebviewCrashInfo;
  onReload: VoidFunction;
};

export const CrashOverlay = ({ crash, onReload }: Props) => {
  const { t } = useTranslation();

  const timestamp = new Date(crash.at).toLocaleTimeString();

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-bg-surface-main p-12">
      <div className="flex flex-col items-center gap-2 self-stretch">
        <div className="pb-4">
          <OctagonXIcon className="h-8 w-8 text-fg-primary" />
        </div>
        <h1 className="w-full text-center text-base font-medium text-fg-primary">{t('widget.webview.crash.title')}</h1>
        <p className="w-full text-center text-sm font-normal text-fg-secondary">{t('widget.webview.crash.subtitle')}</p>
      </div>

      <div className="flex flex-col items-center gap-4 self-stretch" style={{ appRegion: 'no-drag' }}>
        <Button data-testid="crash-overlay-reload" onClick={onReload}>
          <RefreshCwIcon className="h-4 w-4" />
          {t('widget.webview.crash.reload')}
        </Button>
      </div>

      <details className="w-full max-w-sm text-xs text-fg-tertiary" data-testid="crash-overlay-details">
        <summary className="cursor-pointer select-none">{t('widget.webview.crash.advanced')}</summary>
        <div className="mt-2 flex flex-col gap-1 break-all">
          <span>{t('widget.webview.crash.reason', { reason: crash.reason })}</span>
          <span>{t('widget.webview.crash.exitCode', { code: crash.exitCode })}</span>
          <span>{crash.url}</span>
          <span>{timestamp}</span>
          {isElectron() && (
            <span className="-ms-3 mt-1 flex self-start">
              <Button variant="ghost" size="sm" onClick={() => window.App?.exportLogs()}>
                {t('common.action.downloadLogs')}
              </Button>
            </span>
          )}
        </div>
      </details>
    </div>
  );
};
