import { useEffect } from 'react';

import { useLooseRef } from './useLooseRef';

/**
 * Closes a non-modal layer while it is open when the window loses focus or resizes.
 *
 * Non-modal Radix popovers detect an outside click through a document `pointerdown`, which never fires for a click
 * inside an embedded frame or on a window drag region. A dismiss overlay covers the drag region; window `blur` and
 * `resize` close the layer when a frame takes focus.
 */
export function useCloseOnWindowLeave(open: boolean, close: VoidFunction): void {
  const getClose = useLooseRef(close);

  useEffect(() => {
    if (!open) return;
    const handle = () => getClose()();
    window.addEventListener('blur', handle);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('blur', handle);
      window.removeEventListener('resize', handle);
    };
  }, [open, getClose]);
}
