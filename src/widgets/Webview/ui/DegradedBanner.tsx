import { Button } from '@novasamatech/tr-ui';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { type FC, useState } from 'react';

import { useTranslation } from '@/shared/translation';
import { type WebviewHealthReason } from '@/aggregates/webview-registry';

type Props = {
  reason: WebviewHealthReason;
  onReload: VoidFunction;
};

export const DegradedBanner: FC<Props> = ({ reason, onReload }) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      data-testid="degraded-banner"
      className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between gap-2 bg-general-background/95 px-3 py-2 text-sm text-text-secondary shadow-sm backdrop-blur-sm"
      style={{ appRegion: 'no-drag' }}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span>{t('widget.webview.degraded.title')}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button data-testid="degraded-banner-reload" variant="outline" onClick={onReload}>
          <RefreshCw className="h-3 w-3" />
          {t('widget.webview.degraded.reload')}
        </Button>
        <button
          data-testid="degraded-banner-dismiss"
          type="button"
          className="p-1 text-text-tertiary hover:text-text-secondary"
          aria-label={t('widget.webview.degraded.dismiss')}
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <details className="sr-only" data-testid="degraded-banner-reason">
        <summary>{reason.kind}</summary>
      </details>
    </div>
  );
};
