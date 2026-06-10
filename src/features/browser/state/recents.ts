import { createState, persistLocalStorage } from '@/shared/rxstate';

export const MAX_RECENTS = 20;

const recent$ = createState<string[]>([]);

persistLocalStorage(recent$, { key: 'recents/v1' });

const recordRecent = (identifier: string) => {
  recent$.set(prev => [identifier, ...prev.filter(id => id !== identifier)].slice(0, MAX_RECENTS));
};

const removeRecent = (identifier: string) => {
  recent$.set(prev => prev.filter(id => id !== identifier));
};

export const recents = {
  recent$,
  recordRecent,
  removeRecent,
};
