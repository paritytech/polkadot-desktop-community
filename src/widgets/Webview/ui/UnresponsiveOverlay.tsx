import LoaderCircleIcon from '@/shared/assets/images/icons/loader-circle.svg?jsx';
import RefreshCwIcon from '@/shared/assets/images/icons/refresh-cw.svg?jsx';
import { Button } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type WebviewUnresponsiveInfo } from '@/aggregates/webview-registry';

type Props = {
  info: WebviewUnresponsiveInfo;
  onReload: VoidFunction;
};

export const UnresponsiveOverlay = ({ info, onReload }: Props) => {
  const { t } = useTranslation();

  const timestamp = new Date(info.at).toLocaleTimeString();

  return (
    <div className="absolute inset-0 flex items-center justify-center p-12">
      <div
        className="flex max-w-sm flex-col items-center gap-6 rounded-lg bg-bg-surface-main/85 p-6 shadow-lg backdrop-blur-sm"
        style={{ appRegion: 'no-drag' }}
      >
        <div className="flex flex-col items-center gap-2 self-stretch">
          <div className="pb-2">
            <LoaderCircleIcon className="h-8 w-8 animate-spin text-fg-secondary" />
          </div>
          <h1 className="w-full text-center text-base font-medium text-fg-primary">{t('widget.webview.unresponsive.title')}</h1>
          <p className="w-full text-center text-sm font-normal text-fg-secondary">{t('widget.webview.unresponsive.subtitle')}</p>
        </div>

        <Button data-testid="unresponsive-overlay-reload" onClick={onReload}>
          <RefreshCwIcon className="h-4 w-4" />
          {t('widget.webview.unresponsive.reload')}
        </Button>

        <details className="w-full text-xs text-fg-tertiary" data-testid="unresponsive-overlay-details">
          <summary className="cursor-pointer select-none">{t('widget.webview.unresponsive.advanced')}</summary>
          <div className="mt-2 flex flex-col gap-1 break-all">
            <span>{info.url}</span>
            <span>{timestamp}</span>
          </div>
        </details>
      </div>
    </div>
  );
};
