import { type FC, useState } from 'react';

import { Button, IconButton } from '@/shared/components';
import { RefreshCwIcon, TriangleExclamationPointIcon, XIcon } from '@/shared/icons';
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
      className="absolute start-0 end-0 top-0 z-10 flex items-center justify-between gap-2 bg-bg-surface-main/95 px-3 py-2 text-sm text-fg-secondary shadow-sm backdrop-blur-sm"
      style={{ appRegion: 'no-drag' }}
    >
      <span className="flex items-center gap-2">
        <TriangleExclamationPointIcon className="h-4 w-4 shrink-0" />
        <span>{t('widget.webview.degraded.title')}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button data-testid="degraded-banner-reload" onClick={onReload}>
          <RefreshCwIcon className="size-3" />
          {t('widget.webview.degraded.reload')}
        </Button>
        <IconButton
          data-testid="degraded-banner-dismiss"
          size="sm"
          label={t('widget.webview.degraded.dismiss')}
          onClick={() => setDismissed(true)}
        >
          <XIcon />
        </IconButton>
      </div>
      <details className="sr-only" data-testid="degraded-banner-reason">
        <summary>{reason.kind}</summary>
      </details>
    </div>
  );
};
