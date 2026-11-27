import { dotNsService } from '@/domains/product';
import { type TabRef } from '@/aggregates/browser-tabs';

import { SWIPE_AXIS_SLOP_PX, SWIPE_LIFT_DECAYS, SWIPE_THRESHOLD_PX } from './constants';
import { NEW_TAB } from './tabs/helpers';
import { type SwipeAvailability, type SwipeIndicatorState, type SwipeState, type SwipeWheel } from './types';

// The first few pixels of a gesture decide it; everything after only moves the distance — until the fingers lift.
function reduceSwipe(state: SwipeState, wheel: SwipeWheel, availability: SwipeAvailability): SwipeState {
  if (state.status === 'rejected' || state.status === 'committed') return state;

  const magnitude = Math.abs(wheel.deltaX);

  if (state.status === 'idle' || state.status === 'deciding') {
    if (wheel.consumed) return { status: 'rejected' };
    const deltaX = (state.status === 'deciding' ? state.deltaX : 0) + wheel.deltaX;
    const deltaY = (state.status === 'deciding' ? state.deltaY : 0) + wheel.deltaY;
    if (Math.abs(deltaX) + Math.abs(deltaY) < SWIPE_AXIS_SLOP_PX) return { status: 'deciding', deltaX, deltaY };
    if (Math.abs(deltaY) >= Math.abs(deltaX)) return { status: 'rejected' };
    const direction = deltaX < 0 ? 'back' : 'forward';
    const possible = direction === 'back' ? availability.canGoBack : availability.canGoForward;
    if (!possible) return { status: 'rejected' };

    return { status: 'tracking', direction, distance: Math.abs(deltaX), lastMagnitude: magnitude, decays: 0 };
  }

  const along = state.direction === 'back' ? -wheel.deltaX : wheel.deltaX;
  const distance = Math.max(0, state.distance + along);
  // Moving fingers make |deltaX| jump; once they lift, macOS momentum decays it smoothly. Electron exposes no gesture
  // phase, so that decay is the release signal.
  // Momentum never flips sign nor stops moving, so only a same-direction, non-growing step counts.
  const decays = along > 0 && magnitude <= state.lastMagnitude ? state.decays + 1 : 0;
  if (distance >= SWIPE_THRESHOLD_PX && decays >= SWIPE_LIFT_DECAYS) return { status: 'committed', direction: state.direction };

  return { ...state, distance, lastMagnitude: magnitude, decays };
}

function toSwipeIndicator(state: SwipeState): SwipeIndicatorState | null {
  if (state.status !== 'tracking') return null;

  return { direction: state.direction, progress: Math.min(state.distance / SWIPE_THRESHOLD_PX, 1) };
}

// A tab's history usually starts with the new-tab page it was opened from; a swipe never returns there.
function canSwipeTo(entry: TabRef | null): boolean {
  return entry !== null && entry.type !== NEW_TAB;
}

// `name` is the product's label as the domain names it, cut from the path by position so it keeps the typed casing:
// it ends at the host's last dot (the TLD's), or at the host's end when the host has no dot. `labelOf` lowercases, which
// can lengthen a non-ASCII label; the clamp keeps `prefix + name + rest === path`.
function splitDisplayAddress(path: string): { prefix: string; name: string; rest: string } {
  const slash = path.indexOf('/');
  const host = slash === -1 ? path : path.slice(0, slash);
  const end = host.includes('.') ? host.lastIndexOf('.') : host.length;
  const start = Math.max(0, end - dotNsService.labelOf(host).length);

  return { prefix: path.slice(0, start), name: path.slice(start, end), rest: path.slice(end) };
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  if (mb >= 10) return `${Math.round(mb)}MB`;
  return `${mb.toFixed(1)}MB`;
}

export const browserService = { reduceSwipe, toSwipeIndicator, canSwipeTo, splitDisplayAddress, formatMemory };
