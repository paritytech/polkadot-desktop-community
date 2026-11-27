import { useEffect, useRef, useState } from 'react';

import MinusIcon from '@/shared/assets/images/icons/minus.svg?jsx';
import PlusIcon from '@/shared/assets/images/icons/plus.svg?jsx';
import RotateCcwIcon from '@/shared/assets/images/icons/rotate-ccw.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useZoomControls, useZoomPercent } from '@/aggregates/webview-zoom';

type Props = {
  tabId: string;
};

const VISIBLE_MS = 1500;

/**
 * Transient zoom indicator shown over the top-center of a product tab. Surfaces only
 * when the zoom percentage actually changes — i.e. a user zoom action — and auto-fades.
 * It deliberately stays hidden on mount/remount (tab switch, product reload) where the
 * persisted level is merely re-read, so it never flashes "for nothing".
 */
export const ZoomIndicator = ({ tabId }: Props) => {
  const { t } = useTranslation();
  const percent = useZoomPercent(tabId);
  const { zoomIn, zoomOut, reset } = useZoomControls(tabId);
  const [visible, setVisible] = useState(false);

  // Show only on an actual change in percent. Seeding the ref with the mount-time
  // percent makes the first render (and any remount on tab switch / reload) a no-op —
  // only a subsequent user-driven zoom differs from the previous value and surfaces it.
  const prevPercentRef = useRef(percent);
  useEffect(() => {
    if (percent === prevPercentRef.current) return;
    prevPercentRef.current = percent;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [percent]);

  if (!visible) return null;

  return (
    <div
      data-testid={TEST_IDS.zoomIndicator}
      className="animate-find-bar-in absolute top-3 left-1/2 z-50 flex h-control -translate-x-1/2 items-center gap-1 rounded-lg border border-stroke-primary bg-bg-surface-nested px-2 shadow-md"
      style={{ appRegion: 'no-drag' }}
    >
      <IconButton size="sm" data-testid={TEST_IDS.zoomOut} label={t('feature.browser.zoomOut')} onClick={zoomOut}>
        <MinusIcon />
      </IconButton>

      <span
        role="status"
        aria-live="polite"
        data-testid={TEST_IDS.zoomPercent}
        className="w-12 text-center text-sm text-fg-primary tabular-nums"
      >
        {t('feature.browser.zoomPercent', { percent })}
      </span>

      <IconButton size="sm" data-testid={TEST_IDS.zoomIn} label={t('feature.browser.zoomIn')} onClick={zoomIn}>
        <PlusIcon />
      </IconButton>

      <IconButton size="sm" data-testid={TEST_IDS.zoomReset} label={t('feature.browser.zoomReset')} onClick={reset}>
        <RotateCcwIcon />
      </IconButton>
    </div>
  );
};
