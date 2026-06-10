import { useTheme } from '@novasamatech/tr-ui';
import { useEffect } from 'react';

import { useBrowserTheme } from '@/shared/hooks';

export const ThemeSyncer = () => {
  const { setMode } = useTheme();
  const theme = useBrowserTheme();

  useEffect(() => {
    setMode(theme);
  }, [theme, setMode]);

  return null;
};
