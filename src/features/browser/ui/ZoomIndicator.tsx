import { Minus, Plus, RotateCcw } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
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
      className="animate-find-bar-in absolute top-3 left-1/2 z-50 flex h-8 -translate-x-1/2 items-center gap-1 rounded-lg border border-border-primary bg-bg-surface-nested px-2 shadow-md"
      style={{ appRegion: 'no-drag' }}
    >
      <ZoomButton testId={TEST_IDS.zoomOut} ariaLabel={t('feature.browser.zoomOut')} onClick={zoomOut}>
        <Minus className="size-4" aria-hidden />
      </ZoomButton>

      <span
        role="status"
        aria-live="polite"
        data-testid={TEST_IDS.zoomPercent}
        className="w-12 text-center text-sm text-fg-primary tabular-nums"
      >
        {t('feature.browser.zoomPercent', { percent })}
      </span>

      <ZoomButton testId={TEST_IDS.zoomIn} ariaLabel={t('feature.browser.zoomIn')} onClick={zoomIn}>
        <Plus className="size-4" aria-hidden />
      </ZoomButton>

      <ZoomButton testId={TEST_IDS.zoomReset} ariaLabel={t('feature.browser.zoomReset')} onClick={reset}>
        <RotateCcw className="size-4" aria-hidden />
      </ZoomButton>
    </div>
  );
};

type ZoomButtonProps = {
  testId: string;
  ariaLabel: string;
  onClick: VoidFunction;
  children: ReactNode;
};

const ZoomButton = ({ testId, ariaLabel, onClick, children }: ZoomButtonProps) => {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      className={cnTw(
        'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-secondary transition-all duration-100',
        'hover:bg-bg-action-secondary-hover hover:text-fg-primary active:scale-90',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
