import { describe, expect, it } from 'vitest';

import { SWIPE_IDLE, SWIPE_THRESHOLD_PX } from './constants';
import { browserService } from './service';
import { NEW_TAB, PRODUCT } from './tabs/helpers';
import { type SwipeState } from './types';

const both = { canGoBack: true, canGoForward: true };

function feed(wheels: [number, number, boolean?][], availability = both): SwipeState {
  let state = SWIPE_IDLE;
  for (const [deltaX, deltaY, consumed = false] of wheels) {
    state = browserService.reduceSwipe(state, { deltaX, deltaY, consumed }, availability);
  }
  return state;
}

describe('browserService.reduceSwipe', () => {
  it('starts tracking back on a leftward delta (fingers moving right)', () => {
    expect(feed([[-10, 1]])).toMatchObject({ status: 'tracking', direction: 'back', distance: 10 });
  });

  it('starts tracking forward on a rightward delta', () => {
    expect(feed([[10, 1]])).toMatchObject({ status: 'tracking', direction: 'forward', distance: 10 });
  });

  it('decides the axis on the first few pixels, not on a single tick', () => {
    expect(feed([[-1, 0]])).toEqual({ status: 'deciding', deltaX: -1, deltaY: 0 });
    expect(
      feed([
        [-1, 0],
        [0.5, 10],
      ]),
    ).toEqual({ status: 'rejected' });
    expect(
      feed([
        [-1, 0],
        [-2, 1],
        [-3, 0],
      ]),
    ).toMatchObject({ status: 'tracking', direction: 'back', distance: 6 });
  });

  it('rejects a gesture consumed while its axis is undecided', () => {
    expect(
      feed([
        [-1, 0],
        [-5, 0, true],
      ]),
    ).toEqual({ status: 'rejected' });
  });

  it('rejects a vertical-dominant first event and stays rejected', () => {
    expect(feed([[3, 10]])).toEqual({ status: 'rejected' });
    expect(
      feed([
        [3, 10],
        [-50, 0],
        [-50, 0],
      ]),
    ).toEqual({ status: 'rejected' });
  });

  it('rejects an equal-axis first event', () => {
    expect(feed([[5, 5]])).toEqual({ status: 'rejected' });
  });

  it('rejects a consumed first event', () => {
    expect(feed([[-10, 0, true]])).toEqual({ status: 'rejected' });
  });

  it('rejects a direction that cannot navigate', () => {
    expect(feed([[-10, 0]], { canGoBack: false, canGoForward: true })).toEqual({ status: 'rejected' });
    expect(feed([[10, 0]], { canGoBack: true, canGoForward: false })).toEqual({ status: 'rejected' });
  });

  it('accumulates along the gesture direction regardless of later drift or consumption', () => {
    expect(
      feed([
        [-10, 0],
        [-20, 30],
        [-25, 0, true],
      ]),
    ).toMatchObject({ status: 'tracking', direction: 'back', distance: 55 });
  });

  it('retracts on reversal and clamps at zero without flipping sides', () => {
    expect(
      feed([
        [-10, 0],
        [30, 0],
      ]),
    ).toMatchObject({ status: 'tracking', direction: 'back', distance: 0 });
    expect(
      feed([
        [-10, 0],
        [30, 0],
        [-40, 0],
      ]),
    ).toMatchObject({ status: 'tracking', direction: 'back', distance: 40 });
  });

  it('commits once full progress is followed by a lift (non-increasing |deltaX| run)', () => {
    expect(
      feed([
        [-100, 0],
        [-60, 0],
        [-50, 0],
        [-40, 0],
      ]),
    ).toEqual({ status: 'committed', direction: 'back' });
  });

  it('does not commit on a lift below the threshold', () => {
    expect(
      feed([
        [-50, 0],
        [-40, 0],
        [-30, 0],
        [-20, 0],
      ]),
    ).toMatchObject({ status: 'tracking', distance: 140 });
  });

  it('does not commit while |deltaX| keeps rising or jumping (fingers still moving)', () => {
    expect(
      feed([
        [-40, 0],
        [-45, 0],
        [-55, 0],
        [-60, 0],
        [-50, 0],
        [-70, 0],
      ]),
    ).toMatchObject({
      status: 'tracking',
      distance: 320,
    });
  });

  it('does not count a reversal or a zero step as a lift', () => {
    expect(
      feed([
        [-150, 0],
        [-100, 0],
        [20, 0],
        [10, 0],
      ]),
    ).toMatchObject({ status: 'tracking', distance: 220 });
    expect(
      feed([
        [-150, 0],
        [-60, 0],
        [0, 5],
        [0, 5],
      ]),
    ).toMatchObject({ status: 'tracking', distance: 210 });
  });

  it('keeps a committed gesture committed for the rest of the momentum', () => {
    expect(
      feed([
        [-100, 0],
        [-60, 0],
        [-50, 0],
        [-40, 0],
        [-30, 0],
        [20, 0],
      ]),
    ).toEqual({
      status: 'committed',
      direction: 'back',
    });
  });
});

describe('browserService.toSwipeIndicator', () => {
  it('is null unless tracking', () => {
    expect(browserService.toSwipeIndicator(SWIPE_IDLE)).toBeNull();
    expect(browserService.toSwipeIndicator({ status: 'rejected' })).toBeNull();
    expect(browserService.toSwipeIndicator({ status: 'committed', direction: 'back' })).toBeNull();
  });

  it('maps distance to progress capped at 1', () => {
    const tracking = { status: 'tracking', lastMagnitude: 0, decays: 0 } as const;
    expect(browserService.toSwipeIndicator({ ...tracking, direction: 'back', distance: SWIPE_THRESHOLD_PX / 2 })).toEqual({
      direction: 'back',
      progress: 0.5,
    });
    expect(browserService.toSwipeIndicator({ ...tracking, direction: 'forward', distance: SWIPE_THRESHOLD_PX * 3 })).toEqual({
      direction: 'forward',
      progress: 1,
    });
  });
});

describe('browserService.canSwipeTo', () => {
  it('accepts a product entry', () => {
    expect(browserService.canSwipeTo({ id: 'app.dot', type: PRODUCT, deeplink: '' })).toBe(true);
  });

  it('canSwipeTo rejects new-tab and missing entries', () => {
    expect(browserService.canSwipeTo({ id: 'nt-1', type: NEW_TAB, deeplink: '' })).toBe(false);
    expect(browserService.canSwipeTo(null)).toBe(false);
  });
});

describe('browserService.splitDisplayAddress', () => {
  it('splits a name from its tld and path', () => {
    expect(browserService.splitDisplayAddress('polkadot.dot/staking')).toEqual({ name: 'polkadot', rest: '.dot/staking' });
  });

  it('splits a name from its tld', () => {
    expect(browserService.splitDisplayAddress('polkadot.dot')).toEqual({ name: 'polkadot', rest: '.dot' });
  });

  it('keeps a bare name whole', () => {
    expect(browserService.splitDisplayAddress('chat')).toEqual({ name: 'chat', rest: '' });
  });

  it('handles an empty path', () => {
    expect(browserService.splitDisplayAddress('')).toEqual({ name: '', rest: '' });
  });

  it('splits at the first dot or slash', () => {
    expect(browserService.splitDisplayAddress('app/route.x')).toEqual({ name: 'app', rest: '/route.x' });
  });
});
