import * as v from 'valibot';

import { createState, persistLocalStorage } from '@/shared/rxstate';

const MAX_RECENT = 6;
const STORAGE_KEY = 'address_bar_recent_v1';

const recentSchema = v.array(v.string());

const decode = (raw: string): string[] => {
  const parsed: unknown = JSON.parse(raw);
  const result = v.safeParse(recentSchema, parsed);

  return result.success ? result.output : [];
};

const recent$ = createState<string[]>([]);

persistLocalStorage(recent$, {
  key: STORAGE_KEY,
  sync: true,
  decode,
});

const addRecent = (productId: string) => {
  recent$.set(prev => [productId, ...prev.filter(id => id !== productId)].slice(0, MAX_RECENT));
};

const removeRecent = (productId: string) => {
  recent$.set(prev => prev.filter(id => id !== productId));
};

const clearRecent = () => {
  recent$.set([]);
};

const restoreRecent = (snapshot: string[]) => {
  recent$.set(snapshot.slice(0, MAX_RECENT));
};

export const recentSearches = {
  recent$,
  addRecent,
  removeRecent,
  clearRecent,
  restoreRecent,
};
