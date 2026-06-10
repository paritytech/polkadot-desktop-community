import { useMemo } from 'react';
import { useObservable } from 'react-rx';
import { combineLatest, map, of } from 'rxjs';

import { type ChatSession } from './types';

export const useTotalUnreadCount = (sessions: ChatSession[]) => {
  const unreadCount$ = useMemo(() => {
    if (sessions.length === 0) return of(0);

    return combineLatest(sessions.map(s => s.unreadCount)).pipe(map(counts => counts.reduce((sum, c) => sum + c, 0)));
  }, [sessions]);

  return useObservable(unreadCount$, 0);
};
