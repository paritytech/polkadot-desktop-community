import { Button } from '@novasamatech/tr-ui';
import { Loader2, RefreshCw } from 'lucide-react';

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
        className="flex max-w-sm flex-col items-center gap-6 rounded-lg bg-general-background/85 p-6 shadow-lg backdrop-blur-sm"
        style={{ appRegion: 'no-drag' }}
      >
        <div className="flex flex-col items-center gap-2 self-stretch">
          <div className="pb-2">
            <Loader2 className="h-8 w-8 animate-spin text-text-secondary" strokeWidth={1.5} />
          </div>
          <h1 className="w-full text-center text-base leading-6 font-medium text-text-primary">
            {t('widget.webview.unresponsive.title')}
          </h1>
          <p className="w-full text-center text-sm leading-5 font-normal text-text-secondary">
            {t('widget.webview.unresponsive.subtitle')}
          </p>
        </div>

        <Button data-testid="unresponsive-overlay-reload" variant="outline" onClick={onReload}>
          <RefreshCw className="h-4 w-4" />
          {t('widget.webview.unresponsive.reload')}
        </Button>

        <details className="w-full text-xs text-text-tertiary" data-testid="unresponsive-overlay-details">
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
