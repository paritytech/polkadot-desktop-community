import { useEffect } from 'react';

import { useThemeName } from '@/domains/application';

export const ThemeNameSyncer = () => {
  const name = useThemeName();

  useEffect(() => {
    document.documentElement.dataset['theme'] = name;
  }, [name]);

  return null;
};
