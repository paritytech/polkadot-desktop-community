import { type RefObject, useEffect } from 'react';

import { useLooseRef } from './useLooseRef';

type EntryCallback = (entry: IntersectionObserverEntry) => void;

const elementCallbacks = new Map<Element, EntryCallback>();

let sharedObserver: IntersectionObserver | null = null;

const getSharedObserver = () => {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        elementCallbacks.get(entry.target)?.(entry);
      }
    });
  }

  return sharedObserver;
};

export const useIntersectionObserver = (ref: RefObject<Element | null>, callback: EntryCallback) => {
  const callbackRef = useLooseRef(callback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = getSharedObserver();
    elementCallbacks.set(el, entry => callbackRef()(entry));
    observer.observe(el);

    return () => {
      elementCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [ref.current]);
};
