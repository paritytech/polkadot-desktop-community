import { useRxState } from '@/shared/rxstate';
import { recentSearches } from '../state/recentSearches';

export const useRecentSearches = () => {
  const [recent] = useRxState(recentSearches.recent$);

  return {
    recent,
    addRecent: recentSearches.addRecent,
    removeRecent: recentSearches.removeRecent,
    clearRecent: recentSearches.clearRecent,
    restoreRecent: recentSearches.restoreRecent,
  };
};
