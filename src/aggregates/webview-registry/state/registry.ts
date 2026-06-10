import { createState } from '@/shared/rxstate';
import { type WebviewCrashInfo, type WebviewHealthEntry, type WebviewUnresponsiveInfo } from '../types';

const ids$ = createState<Record<string, number>>({});
const crashes$ = createState<Record<number, WebviewCrashInfo>>({});
const unresponsive$ = createState<Record<number, WebviewUnresponsiveInfo>>({});
const health$ = createState<Record<number, WebviewHealthEntry>>({});

function dropKey<V>(map: Record<number, V>, key: number): Record<number, V> {
  if (!(key in map)) return map;
  const { [key]: _, ...rest } = map;
  return rest;
}

const clearCrash = (webContentsId: number) => {
  crashes$.set(prev => dropKey(prev, webContentsId));
};

const clearUnresponsive = (webContentsId: number) => {
  unresponsive$.set(prev => dropKey(prev, webContentsId));
};

const setHealth = (entry: WebviewHealthEntry) => {
  // 'healthy' clears the entry; non-healthy stores it. Keeps the map sparse so
  // hooks return null for the common case.
  if (entry.state === 'healthy') {
    if (!(entry.webContentsId in health$.get())) return;
    health$.set(prev => dropKey(prev, entry.webContentsId));
    return;
  }
  health$.set(prev => ({ ...prev, [entry.webContentsId]: entry }));
};

const clearHealth = (webContentsId: number) => {
  health$.set(prev => dropKey(prev, webContentsId));
};

const register = (identifier: string, id: number) => {
  const prevId = ids$.get()[identifier];
  if (prevId === id) return;
  if (prevId !== undefined) {
    clearCrash(prevId);
    clearUnresponsive(prevId);
    clearHealth(prevId);
  }
  // A fresh process under this id must not inherit any stale crash/unresponsive
  // state recorded against a recycled webContentsId.
  clearCrash(id);
  clearUnresponsive(id);
  clearHealth(id);
  ids$.set(prev => ({ ...prev, [identifier]: id }));
};

const unregister = (identifier: string) => {
  const prev = ids$.get();
  if (!(identifier in prev)) return;
  const id = prev[identifier];
  ids$.set(p => {
    const { [identifier]: _, ...rest } = p;
    return rest;
  });
  if (id !== undefined) {
    clearCrash(id);
    clearUnresponsive(id);
    clearHealth(id);
  }
};

const markCrashed = (info: WebviewCrashInfo) => {
  if (crashes$.get()[info.webContentsId]) return;
  crashes$.set(prev => ({ ...prev, [info.webContentsId]: info }));
};

const markUnresponsive = (info: WebviewUnresponsiveInfo) => {
  // Electron repeats `unresponsive` while the renderer stays hung. Keep the
  // first observation so subscribers don't re-render every few seconds.
  if (unresponsive$.get()[info.webContentsId]) return;
  unresponsive$.set(prev => ({ ...prev, [info.webContentsId]: info }));
};

export const webviewRegistry = {
  ids$,
  crashes$,
  unresponsive$,
  health$,
  register,
  unregister,
  markCrashed,
  clearCrash,
  markUnresponsive,
  clearUnresponsive,
  setHealth,
  clearHealth,
};
