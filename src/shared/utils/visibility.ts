import { type Observable, distinctUntilChanged, fromEvent, map, of, shareReplay, startWith, switchMap, timer } from 'rxjs';

const INACTIVE_THRESHOLD_MS = 2 * 60 * 1000;

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

// Visibility, not focus: focus moves to child <webview> WebContents during
// normal product use, which would otherwise mark the host as inactive and
// pause chain subscriptions while the user is still working.
const readActive = (): boolean => {
  if (!hasDom) return true;
  return !document.hidden;
};

const rawActive$: Observable<boolean> = hasDom
  ? fromEvent(document, 'visibilitychange').pipe(map(readActive), startWith(readActive()), distinctUntilChanged())
  : of(true);

/**
 * Emits `true` while the app is visible and `false` after it has been hidden
 * for longer than the threshold.
 *
 * Used to release chain subscriptions while the app is backgrounded so stale
 * chainHead_follow state cannot accumulate across silent WebSocket reconnects.
 */
export const appActive$: Observable<boolean> = rawActive$.pipe(
  switchMap(active => (active ? of(true) : timer(INACTIVE_THRESHOLD_MS).pipe(map(() => false)))),
  distinctUntilChanged(),
  shareReplay({ bufferSize: 1, refCount: false }),
);
