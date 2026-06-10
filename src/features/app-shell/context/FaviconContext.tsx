import { type PropsWithChildren, createContext, useCallback, useContext, useMemo, useState } from 'react';

type FaviconContextValue = {
  hasBadge: boolean;
  addBadgeSource: (source: string) => void;
  removeBadgeSource: (source: string) => void;
};

const FaviconContext = createContext<FaviconContextValue | null>(null);

export const FaviconProvider = ({ children }: PropsWithChildren) => {
  const [badgeSources, setBadgeSources] = useState<Set<string>>(new Set());

  const hasBadge = badgeSources.size > 0;

  const addBadgeSource = useCallback((source: string) => {
    setBadgeSources(prev => new Set([...prev, source]));
  }, []);

  const removeBadgeSource = useCallback((source: string) => {
    setBadgeSources(prev => {
      const next = new Set(prev);
      next.delete(source);
      return next;
    });
  }, []);

  const value = useMemo<FaviconContextValue>(
    () => ({
      hasBadge,
      addBadgeSource,
      removeBadgeSource,
    }),
    [hasBadge, addBadgeSource, removeBadgeSource],
  );

  return <FaviconContext.Provider value={value}>{children}</FaviconContext.Provider>;
};

export const useFavicon = () => {
  const context = useContext(FaviconContext);
  if (!context) {
    throw new Error('useFavicon must be used within FaviconProvider');
  }
  return context;
};
