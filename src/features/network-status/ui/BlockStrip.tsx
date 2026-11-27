import { type FC, useLayoutEffect, useRef } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type BlockBar, type ChainStatus } from '@/domains/network';
import { HISTORY_SLOTS } from '../constants';
import { networkStatusService } from '../service';
import { type PendingBar } from '../types';

type Props = {
  chain: ChainStatus;
  chainName: string;
  pending: PendingBar | null;
};

// Replays the instant shift that appended bars cause as a glide left, so a block arriving reads as an arrival.
function slideStrip(strip: HTMLElement, landed: number) {
  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 0;
  const first = strip.firstElementChild;
  const width = first === null ? 0 : first.getBoundingClientRect().width;
  // The strip starts this far to the right, so the landed bars glide in from where the old ones were.
  const shift = landed * (width + gap);
  if (shift <= 0) {
    return;
  }
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const mark of Array.from(strip.children).slice(-landed)) {
      mark.setAttribute('data-new', '');
      mark.addEventListener('animationend', () => mark.removeAttribute('data-new'), { once: true });
    }
  }
  strip.removeAttribute('data-sliding');
  strip.style.transform = `translateX(${shift}px)`;
  // Commit the untransitioned offset first, or the browser coalesces both writes and nothing moves.
  strip.getBoundingClientRect();
  strip.setAttribute('data-sliding', '');
  strip.style.transform = 'translateX(0)';
}

export const BlockStrip: FC<Props> = ({ chain, chainName, pending }) => {
  const { t } = useTranslation();
  const stripRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<readonly BlockBar[] | null>(null);

  const visible = networkStatusService.showBars(chain);
  const firstSlot = HISTORY_SLOTS - visible.length;
  const stubCount = firstSlot - (pending ? 1 : 0);
  const unused = chain.state === 'unused';

  // Updates that land no block keep the same bar objects, so the same bars mean no block landed.
  useLayoutEffect(() => {
    const previous = shownRef.current;
    if (previous !== null && networkStatusService.sameBars(previous, visible)) {
      return;
    }
    shownRef.current = visible;
    if (previous === null || stripRef.current === null) {
      return;
    }
    const landed = networkStatusService.landedBars(previous, visible);
    if (landed > 0) {
      slideStrip(stripRef.current, landed);
    }
  });

  const describeDelay = (bar: BlockBar) => {
    const { gap, late } = networkStatusService.describeBlockDelay(bar.gapMs, chain.blockTimeMs);

    return late === null
      ? t('feature.networkStatus.block.onTime', { gap })
      : t('feature.networkStatus.block.late', { gap, late });
  };

  return (
    <div className="min-w-0 overflow-hidden text-left" data-state={chain.state}>
      <div
        ref={stripRef}
        dir="ltr"
        role="group"
        title={t('feature.networkStatus.strip.title', { count: HISTORY_SLOTS })}
        aria-label={t('feature.networkStatus.strip.label', { chain: chainName, count: HISTORY_SLOTS })}
        data-testid={TEST_IDS.networkBlockStrip}
        className="relative flex h-3 min-w-0 items-end gap-0.5 overflow-hidden data-sliding:transition-transform data-sliding:duration-340 data-sliding:ease-strip motion-reduce:data-sliding:transition-none"
      >
        {Array.from({ length: stubCount }, (_, slot) => (
          <span
            key={slot}
            data-testid={TEST_IDS.networkBlockStub}
            className="h-1 min-w-0 flex-1 rounded-xs bg-chrome-idle/25"
            style={{ opacity: networkStatusService.slotOpacity(slot) }}
          />
        ))}
        {visible.map((bar, index) => {
          const opacity = networkStatusService.slotOpacity(firstSlot + index);
          const delay = describeDelay(bar);

          return (
            <span
              key={bar.number}
              role="img"
              title={delay}
              aria-label={t('feature.networkStatus.block.label', { number: String(bar.number), delay })}
              data-testid={TEST_IDS.networkBlockBar}
              data-block={bar.number}
              data-health={bar.health}
              className={cnTw(
                'h-full min-w-0 flex-1 origin-bottom rounded-xs data-new:animate-bar-in motion-reduce:data-new:animate-none',
                unused
                  ? 'bg-chrome-idle'
                  : {
                      'bg-chrome-ok': bar.health === 'onTime',
                      'bg-chrome-warn': bar.health === 'late',
                      'bg-chrome-err': bar.health === 'veryLate',
                    },
              )}
              style={{ opacity: unused ? Number(opacity) * 0.5 : opacity }}
            />
          );
        })}
        {pending && (
          <span
            data-testid={TEST_IDS.networkBlockPending}
            data-pending={pending.phase}
            className={cnTw(
              'min-h-2 min-w-0 flex-1 rounded-xs bg-chrome-idle motion-safe:[transition:height_250ms_linear]',
              pending.phase !== 'counting' && 'motion-safe:animate-chain-pulse',
            )}
            style={{ height: pending.phase === 'searching' ? '45%' : `${pending.heightPercent}%` }}
          />
        )}
      </div>
    </div>
  );
};
