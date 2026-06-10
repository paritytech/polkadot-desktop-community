import { useEffect } from 'react';

type Snapshot = {
  pointerEvents: string;
  scrollLocked: boolean;
  overlay: { role: string | null; state: string | null; label: string | null }[];
};

const OVERLAY_SELECTORS = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[data-slot="dialog-overlay"]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-popover-content-wrapper]',
  '[data-radix-dropdown-menu-content-wrapper]',
  '[data-radix-select-content-wrapper]',
];

const snapshot = (): Snapshot => {
  const body = document.body;
  const overlays = document.querySelectorAll(OVERLAY_SELECTORS.join(','));
  const overlay: Snapshot['overlay'] = [];
  for (const el of overlays) {
    overlay.push({
      role: el.getAttribute('role'),
      state: el.getAttribute('data-state'),
      label: el.getAttribute('aria-label') ?? el.getAttribute('data-slot') ?? el.tagName.toLowerCase(),
    });
  }
  return {
    pointerEvents: body.style.pointerEvents || '(empty)',
    scrollLocked: body.hasAttribute('data-scroll-locked'),
    overlay,
  };
};

const eq = (a: Snapshot, b: Snapshot): boolean => a.pointerEvents === b.pointerEvents && a.scrollLocked === b.scrollLocked;

/**
 * Dev-only tracer. Logs every body lock state transition with a stack trace
 * and a snapshot of currently-open Radix overlays. Used to identify which
 * component leaks the scroll lock when a Radix portal unmounts mid-open.
 *
 * Always on while this hook is mounted. To silence at runtime, set
 * `window.__traceBodyLock = false` in DevTools.
 */
export const useBodyLockTracer = () => {
  useEffect(() => {
    // Dev-only diagnostic: never attach the observer/logging in production builds.
    if (!import.meta.env.DEV) return;
    if (typeof document === 'undefined') return;

    const isOn = () =>
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (window as unknown as { __traceBodyLock?: boolean }).__traceBodyLock !== false;

    let last = snapshot();

    const onChange = () => {
      const next = snapshot();
      if (eq(last, next)) {
        last = next;
        return;
      }
      if (!isOn()) {
        last = next;
        return;
      }

      const stack = new Error('body lock transition').stack ?? '(no stack)';

      console.groupCollapsed(
        `[body-lock] pe=${last.pointerEvents}→${next.pointerEvents} locked=${last.scrollLocked}→${next.scrollLocked}`,
      );
      // eslint-disable-next-line no-console
      console.log('overlays before →', last.overlay);
      // eslint-disable-next-line no-console
      console.log('overlays after  →', next.overlay);
      // eslint-disable-next-line no-console
      console.log(stack);

      console.groupEnd();

      last = next;
    };

    const observer = new MutationObserver(onChange);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'data-scroll-locked'],
    });

    // Also poll once a second to catch direct property mutations the
    // MutationObserver misses (style.setProperty fires, but assignment via
    // style.pointerEvents='' on a previously-set value sometimes doesn't
    // trigger a mutation if the serialized value is identical).
    const interval = window.setInterval(onChange, 1000);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    (window as unknown as { __bodyLockSnapshot?: () => Snapshot }).__bodyLockSnapshot = snapshot;

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      delete (window as unknown as { __bodyLockSnapshot?: () => Snapshot }).__bodyLockSnapshot;
    };
  }, []);
};
