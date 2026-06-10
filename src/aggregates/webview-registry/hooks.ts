import { useMemo } from 'react';

import { type RxState, useRxState } from '@/shared/rxstate';

import { webviewRegistry } from './state/registry';
import { type WebviewCrashInfo, type WebviewHealthEntry, type WebviewUnresponsiveInfo } from './types';

function useWebviewMapEntry<T>(map$: RxState<Record<number, T>>, identifier: string): T | null {
  const [ids] = useRxState(webviewRegistry.ids$);
  const [map] = useRxState(map$);
  return useMemo(() => {
    const id = ids[identifier];
    if (id === undefined) return null;
    return map[id] ?? null;
  }, [ids, map, identifier]);
}

export function useWebviewCrash(identifier: string): WebviewCrashInfo | null {
  return useWebviewMapEntry(webviewRegistry.crashes$, identifier);
}

export function useWebviewUnresponsive(identifier: string): WebviewUnresponsiveInfo | null {
  return useWebviewMapEntry(webviewRegistry.unresponsive$, identifier);
}

export function useWebviewHealth(identifier: string): WebviewHealthEntry | null {
  return useWebviewMapEntry(webviewRegistry.health$, identifier);
}
