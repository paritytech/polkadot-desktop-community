import { useEffect, useState } from 'react';

import { isElectron } from '@/shared/env';

export function useWindowFocus(): boolean {
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
}
