import { memo, useEffect, useState } from 'react';

import { Slot } from '@/shared/di';
import { getPlatformType, isElectron } from '@/shared/env';
import { useWindowFocus } from '@/shared/hooks';
import { cnTw } from '@/shared/utils';
import {
  tabBarSlot,
  topBarCenterLeadingSlot,
  topBarCenterSlot,
  topBarCenterTrailingSlot,
  topBarLeadingSlot,
  topBarTrailingSlot,
} from '../di';

export const Header = memo(() => {
  const isMac = getPlatformType() === 'desktop-mac';
  const isFullscreen = useFullscreen();
  const isFocused = useWindowFocus();

  const tintUnfocused = isMac && !isFocused;
  const macSpacer = isMac && !isFullscreen;

  return (
    // Native OS drag region. Right-clicking it no longer crashes on macOS since
    // the Electron 42.4.0 fix for the AppKit `sendEvent:` regression (#51576).
    <header
      className={cnTw(
        'flex w-full shrink-0 flex-col transition-colors duration-200',
        tintUnfocused ? 'bg-bg-surface-nested dark:bg-bg-surface-container' : 'bg-bg-surface-container',
      )}
      style={{ appRegion: 'drag' }}
    >
      <div className="flex h-12 items-center">
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center border-stroke-primary">
          {/* The macOS traffic lights are OS chrome pinned to the physical top-left; they do not
              move under `dir="rtl"`. This flex row does, so the spacer that clears them is rendered
              in whichever track ends up on the physical left — the leading one in LTR, the trailing
              one in RTL — and hidden in the other. Reserving the space with physical padding on
              <header> instead would shift the centred address bar in LTR too. */}
          {macSpacer ? <div className="pointer-events-none h-full w-21.5 rtl:hidden" /> : null}
          <Slot id={topBarLeadingSlot} />
        </div>
        {/* Three tracks: the address bar sits in the centered middle track while
            the equal 1fr side tracks keep it window-centered regardless of what
            the leading/trailing slots hold (e.g. the new-tab button). The middle
            track mirrors the address bar's own min/max width (min-w-80 / max-w-150). */}
        <div className="grid min-w-0 flex-1 basis-0 grid-cols-[1fr_minmax(20rem,37.5rem)_1fr] items-center gap-1 px-4">
          <div className="flex min-w-0 items-center justify-end gap-1">
            <Slot id={topBarCenterLeadingSlot} />
          </div>
          <Slot id={topBarCenterSlot} />
          <div className="flex min-w-0 items-center justify-start gap-1">
            <Slot id={topBarCenterTrailingSlot} />
          </div>
        </div>
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center justify-end gap-1 pe-2">
          <Slot id={topBarTrailingSlot} />
          {/* Last child, so in RTL — where this track sits on the physical left — it lands against
              the window edge, under the traffic lights. See the note on the leading track. */}
          {macSpacer ? <div className="pointer-events-none h-full w-21.5 ltr:hidden" /> : null}
        </div>
      </div>
      <Slot id={tabBarSlot} />
    </header>
  );
});

const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isElectron()) {
      return window.App.onFullscreenChange(setIsFullscreen);
    }

    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return isFullscreen;
};
