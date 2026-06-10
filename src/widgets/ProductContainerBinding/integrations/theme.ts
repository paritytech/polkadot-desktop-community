import { type CodecType, type Theme } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useEffect } from 'react';

import { type ResolvedTheme, useBrowserTheme, useLooseRef, useSubscription } from '@/shared/hooks';

// v0.8: host_theme_subscribe delivers a { name, variant } struct instead of a flat 'light' | 'dark'.
// The browser only resolves light/dark, so we always report the Default theme name and map the
// resolved value onto the capitalized variant the wire now expects.
function toTheme(resolved: ResolvedTheme): CodecType<typeof Theme> {
  return {
    name: { tag: 'Default', value: undefined },
    variant: resolved === 'dark' ? 'Dark' : 'Light',
  };
}

export function useTheme(container: Container) {
  const theme = useBrowserTheme();
  const themeRef = useLooseRef(theme);
  const subscribeTheme = useSubscription(theme);

  useEffect(() => {
    container.handleThemeSubscribe((_, send) => {
      send(toTheme(themeRef()));
      return subscribeTheme(resolved => send(toTheme(resolved)));
    });
  }, [container]);
}
