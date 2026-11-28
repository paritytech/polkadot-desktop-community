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
        'flex w-full shrink-0 flex-col text-chrome-text shadow-chrome-edge',
        tintUnfocused ? 'bg-chrome-bottom' : 'bg-(image:--chrome-glass)',
      )}
      style={{ appRegion: 'drag' }}
    >
      {/* The equal 1fr side tracks keep the auto middle track window-centered. */}
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex h-full min-w-0 items-center">
          {/* The macOS traffic lights are OS chrome pinned to the physical top-left; they do not
              move under `dir="rtl"`. This row does, so the spacer that clears them is rendered
              in whichever track ends up on the physical left — the leading one in LTR, the trailing
              one in RTL — and hidden in the other. Reserving the space with physical padding on
              <header> instead would shift the centred address bar in LTR too. */}
          {macSpacer ? <div className="pointer-events-none h-full w-21.5 rtl:hidden" /> : null}
          <Slot id={topBarLeadingSlot} />
        </div>
        {/* The center group sizes to its content, so its own 1fr tracks come out equal, as wide as
            the wider side, and the address bar stays centered whatever the slots hold. The bar's
            track is a fixed width: the bar fills its track, and an auto track would follow the
            length of the address it shows. The width steps down on narrow windows so the side
            tracks keep room for their buttons. */}
        <div className="grid grid-cols-[1fr_16rem_1fr] items-center gap-1 lg:grid-cols-[1fr_22rem_1fr] xl:grid-cols-[1fr_28rem_1fr]">
          <div className="flex items-center justify-end gap-1">
            <Slot id={topBarCenterLeadingSlot} />
          </div>
          <Slot id={topBarCenterSlot} />
          <div className="flex items-center gap-1">
            <Slot id={topBarCenterTrailingSlot} />
          </div>
        </div>
        <div className="flex h-full min-w-0 items-center justify-end gap-1 pe-2">
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
