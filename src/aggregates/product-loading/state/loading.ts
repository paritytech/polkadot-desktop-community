import { createState } from '@/shared/rxstate';

const identifiers$ = createState<Set<string>>(new Set());

const set = (identifier: string, loading: boolean) => {
  identifiers$.set(prev => {
    if (prev.has(identifier) === loading) return prev;
    const next = new Set(prev);
    if (loading) next.add(identifier);
    else next.delete(identifier);

    return next;
  });
};

export const productLoading = {
  identifiers$,
  set,
};
