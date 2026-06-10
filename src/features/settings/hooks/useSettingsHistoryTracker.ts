import { useLocation } from '@tanstack/react-router';
import { useEffect } from 'react';

import { EMPTY_HISTORY, recordNavigation, settingsHistory$ } from '../state/history';

/**
 * Records the current Settings pathname into the in-memory navigation history.
 * Resets history when the Settings shell unmounts so the next visit starts fresh.
 */
export const useSettingsHistoryTracker = () => {
  const pathname = useLocation({ select: location => location.pathname });

  useEffect(() => {
    settingsHistory$.set(history => recordNavigation(history, pathname));
  }, [pathname]);

  useEffect(
    () => () => {
      settingsHistory$.set(EMPTY_HISTORY);
    },
    [],
  );
};
