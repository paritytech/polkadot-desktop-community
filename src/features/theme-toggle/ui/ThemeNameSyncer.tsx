import { themes, useTheme } from '@novasamatech/tr-ui';
import { useEffect } from 'react';

import { useThemeName } from '@/domains/application';

export const ThemeNameSyncer = () => {
  const { setTheme } = useTheme();
  const name = useThemeName();

  useEffect(() => {
    document.documentElement.dataset['theme'] = name;
    const theme = themes[name];
    if (theme) setTheme(theme);
  }, [name, setTheme]);

  return null;
};
