import { ChevronLeftIcon, ChevronRightIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type SwipeIndicatorState } from '../types';

type Props = { indicator: SwipeIndicatorState | null };

// Travel of the arrow from fully hidden behind the edge to its resting inset, in px.
const HIDDEN_OFFSET = 48;
const RESTING_INSET = 16;
const MIN_SCALE = 0.6;

// Decorative (`aria-hidden`): the toolbar buttons are the accessible path to the same navigation.
export const SwipeNavigationIndicator = ({ indicator }: Props) => {
  if (!indicator) return null;

  const { direction, progress } = indicator;
  const complete = progress >= 1;
  const edge = direction === 'back' ? 'left' : 'right';
  const travel = -HIDDEN_OFFSET + (HIDDEN_OFFSET + RESTING_INSET) * progress;
  const scale = MIN_SCALE + (1 - MIN_SCALE) * progress;
  const Icon = direction === 'back' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <div
      data-testid={TEST_IDS.swipeNavigationIndicator}
      data-edge={edge}
      data-complete={complete}
      aria-hidden
      className={cnTw(
        'pointer-events-none absolute top-1/2 z-50 flex size-10 items-center justify-center rounded-full',
        'shadow-md',
        edge === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        opacity: Math.min(progress * 2, 1),
        backgroundColor: `color-mix(in oklab, var(--bg-action-primary) ${Math.round(progress * 100)}%, var(--bg-surface-nested))`,
        transform: `translate(${edge === 'left' ? travel : -travel}px, -50%) scale(${scale})`,
      }}
    >
      <Icon
        className={cnTw(
          'rtl:-scale-x-100',
          'size-5 transition-colors duration-100',
          complete ? 'text-fg-primary-inverted' : 'text-fg-secondary',
        )}
      />
    </div>
  );
};
