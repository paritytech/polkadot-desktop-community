import { useCallback, useEffect, useRef, useState } from 'react';

import { type SearchResult } from '@/domains/chat';
import { useSearchPeers } from '@/aggregates/p2p-chat';

/**
 * Debounced contact search for the chat UI. Owns the UI-local state (debounce
 * timer, results, pending, error); the actual peer lookup is the manager-bound
 * `useSearchPeers` from the `p2p-chat` aggregate.
 */
export const useContactSearch = () => {
  const { searchPeers, ready } = useSearchPeers();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchError(null);

      if (!query.trim() || !ready) {
        setResults([]);
        setPending(false);

        return;
      }

      setPending(true);
      debounceRef.current = setTimeout(() => {
        searchPeers(query)
          .then(setResults)
          .catch((e: unknown) => {
            setResults([]);
            setSearchError(e instanceof Error ? e.message : 'Search failed');
          })
          .finally(() => setPending(false));
      }, 300);
    },
    [searchPeers, ready],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { search, results, pending, searchError };
};
