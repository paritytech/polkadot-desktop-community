import { type ElementType, type MouseEvent, type PropsWithChildren, useCallback, useEffect, useRef } from 'react';

import { getPlatformType } from '@/shared/env';

// Native controls that own the pointer — dragging from them would swallow clicks.
const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [role="menuitem"], [contenteditable="true"], [data-window-no-drag]';

function isExcludedElement(element: Element): boolean {
  if (element.matches(INTERACTIVE_SELECTOR)) return true;

  // Honor the codebase's existing `app-region: no-drag` markers.
  return element instanceof HTMLElement && element.style.getPropertyValue('app-region') === 'no-drag';
}

// A drag must not start over a control. The walk is bounded to the region: an
// excluded ancestor *above* it (e.g. the app shell's own no-drag wrapper) is
// irrelevant and must not disable dragging.
function isDragExcluded(target: EventTarget | null, region: Element): boolean {
  let element = target instanceof Element ? target : null;

  while (element) {
    if (isExcludedElement(element)) return true;
    if (element === region) break;
    element = element.parentElement;
  }

  return false;
}

type WindowDragRegionProps = PropsWithChildren<{
  as?: ElementType;
  className?: string;
}>;

/**
 * Makes its area draggable as the OS window.
 *
 * On macOS it implements dragging in JS (pointer down → IPC → `win.setPosition`)
 * instead of `-webkit-app-region: drag`, because right-clicking a native drag
 * region crashes the process on macOS + Electron 42 (SIGSEGV in AppKit
 * `sendEvent:`). On Windows/Linux the native CSS drag region is kept — it does
 * not crash there and feels smoother. On web there is no window to drag.
 */
export const WindowDragRegion = ({ as: Tag = 'div', className, children }: WindowDragRegionProps) => {
  const platform = getPlatformType();
  const isMac = platform === 'desktop-mac';
  const isOtherDesktop = platform === 'desktop-windows' || platform === 'desktop-linux';

  // Cleanup for the in-flight drag's window listeners; null when not dragging.
  const dragCleanupRef = useRef<VoidFunction | null>(null);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (event.button !== 0 || isDragExcluded(event.target, event.currentTarget) || dragCleanupRef.current) return;

    window.App?.startWindowDrag();

    // End on release anywhere (the cursor often leaves the window mid-drag) and
    // on blur, so the window never stays glued to the cursor.
    const end = () => {
      window.App?.endWindowDrag();
      detach();
    };
    const detach = () => {
      window.removeEventListener('mouseup', end);
      window.removeEventListener('blur', end);
      dragCleanupRef.current = null;
    };

    window.addEventListener('mouseup', end);
    window.addEventListener('blur', end);
    dragCleanupRef.current = end;
  }, []);

  // Finish any in-flight drag on unmount — without this, the main-process
  // reposition loop would keep running until its safety timeout fires.
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const handleDoubleClick = useCallback((event: MouseEvent) => {
    if (isDragExcluded(event.target, event.currentTarget)) return;
    window.App?.toggleMaximizeWindow();
  }, []);

  if (isMac) {
    return (
      <Tag className={className} onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={className} style={isOtherDesktop ? { appRegion: 'drag' } : undefined}>
      {children}
    </Tag>
  );
};
