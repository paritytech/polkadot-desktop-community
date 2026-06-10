import { useEffect } from 'react';

/**
 * Watchdog for stuck Radix UI scroll locks.
 *
 * Radix portals (Dialog, Popover, DropdownMenu, AlertDialog, Select) use
 * react-remove-scroll, which sets `data-scroll-locked="1"` and
 * `pointer-events: none` on `<body>` while open. When a portal's parent
 * unmounts abruptly (route change, sandbox dispose, error boundary trip)
 * the body lock can stay behind and freeze the entire UI.
 *
 * We only undo the body-level side-effects (attribute + inline styles).
 * We do **not** touch the portal DOM nodes themselves: Radix renders
 * them via `createPortal`, so React's fiber tree still owns them.
 * Removing them from the DOM here would leave React with stale child
 * pointers and trigger `Failed to execute 'removeChild' on 'Node'` the
 * next time React commits an unmount in that tree.
 */
const POLL_INTERVAL_MS = 1000;

const OPEN_OVERLAY_SELECTORS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-popover-content-wrapper]',
  '[data-radix-dropdown-menu-content-wrapper]',
  '[data-radix-select-content-wrapper]',
  '[data-state="open"][role]',
];

const isOverlayOpen = (): boolean => {
  return document.querySelector(OPEN_OVERLAY_SELECTORS.join(',')) !== null;
};

const isBodyLocked = (body: HTMLElement): boolean => {
  return body.hasAttribute('data-scroll-locked') || body.style.pointerEvents === 'none' || body.style.overflow === 'hidden';
};

const releaseBody = (body: HTMLElement): void => {
  body.removeAttribute('data-scroll-locked');
  if (body.style.pointerEvents === 'none') body.style.pointerEvents = '';
  if (body.style.overflow === 'hidden') body.style.overflow = '';
  if (body.style.marginRight) body.style.marginRight = '';
  body.style.removeProperty('--removed-body-scroll-bar-size');
};

export const installScrollLockGuard = () => {
  if (typeof document === 'undefined') return () => {};

  const body = document.body;

  const releaseIfLeaked = () => {
    if (!isBodyLocked(body)) return;
    if (isOverlayOpen()) return;
    releaseBody(body);
  };

  let scheduled = false;
  const scheduleCheck = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      releaseIfLeaked();
    });
  };

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(body, {
    attributes: true,
    attributeFilter: ['data-scroll-locked', 'style'],
    childList: true,
    subtree: true,
  });

  const interval = window.setInterval(releaseIfLeaked, POLL_INTERVAL_MS);

  const onPointerDown = () => scheduleCheck();
  window.addEventListener('pointerdown', onPointerDown, { capture: true });

  // Manual recovery hatch for DevTools — releases body lock only.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  (window as unknown as { __unstuck?: () => void }).__unstuck = () => releaseBody(body);

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
    window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    delete (window as unknown as { __unstuck?: () => void }).__unstuck;
  };
};

export const useScrollLockGuard = () => {
  useEffect(() => {
    return installScrollLockGuard();
  }, []);
};
