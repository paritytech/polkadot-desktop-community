import { memo, useEffect, useState } from 'react';

import { WindowDragRegion } from '@/shared/components';
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
    <WindowDragRegion
      as="header"
      className={cnTw(
        'flex w-full shrink-0 flex-col transition-colors duration-200',
        tintUnfocused ? 'bg-general-muted dark:bg-bg-surface-container' : 'bg-bg-surface-container',
      )}
    >
      <div className="flex h-12 items-center">
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center border-general-border">
          {isMac && !isFullscreen ? <div className="pointer-events-none h-full w-[86px]" /> : null}
          <Slot id={topBarLeadingSlot} />
        </div>
        <div className="flex min-w-0 flex-1 basis-0 items-center justify-center gap-1 px-4">
          <Slot id={topBarCenterLeadingSlot} />
          <Slot id={topBarCenterSlot} />
          <Slot id={topBarCenterTrailingSlot} />
        </div>
        <div className="flex h-full min-w-0 flex-1 basis-0 items-center justify-end gap-1 pr-2">
          <Slot id={topBarTrailingSlot} />
        </div>
      </div>
      <Slot id={tabBarSlot} />
    </WindowDragRegion>
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
