import { memo, useEffect, useState } from 'react';

import { Slot } from '@/shared/di';
import { getPlatformType, isElectron } from '@/shared/env';
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

  return (
    // Native OS drag region. Right-clicking it no longer crashes on macOS since
    // the Electron 42.4.0 fix for the AppKit `sendEvent:` regression (#51576).
    <header
      className={cnTw(
        'flex w-full shrink-0 flex-col transition-colors duration-200',
        tintUnfocused ? 'bg-general-muted dark:bg-bg-surface-container' : 'bg-bg-surface-container',
      )}
      style={{ appRegion: 'drag' }}
    >
      <div className="flex h-12 items-center">
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center border-general-border">
          {isMac && !isFullscreen ? <div className="pointer-events-none h-full w-[86px]" /> : null}
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
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center justify-end gap-1 pr-2">
          <Slot id={topBarTrailingSlot} />
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

const useWindowFocus = () => {
  const [isFocused, setIsFocused] = useState(() => (typeof document !== 'undefined' ? document.hasFocus() : true));

  useEffect(() => {
    if (isElectron()) {
      return window.App.onWindowFocusChange(setIsFocused);
    }

    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return isFocused;
};
