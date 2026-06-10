import { createState } from '@/shared/rxstate';
import { type FindRequest, type FindRequestMode, type FindSession } from '../types';

const EMPTY_SESSION: FindSession = { visible: false, query: '', matches: 0, activeMatchOrdinal: 0, openSeq: 0 };

// Per-tab find state. Keyed by tabId (which equals the Webview `identifier` in this
// app — there is one tab per product). Sessions survive tab switches because alive
// tabs stay mounted; they are dropped on tab close / reload via clear().
const sessions$ = createState<Record<string, FindSession>>({});

// The command channel the executor consumes. Separate from sessions$ so writing a
// new result (sessions$) never re-triggers the executor, and dispatching a command
// (requests$) never churns the overlay's session selector.
const requests$ = createState<Record<string, FindRequest>>({});

function dropKey<V>(map: Record<string, V>, key: string): Record<string, V> {
  if (!(key in map)) return map;
  const { [key]: _, ...rest } = map;
  return rest;
}

function patchSession(tabId: string, patch: Partial<FindSession>) {
  sessions$.set(prev => ({ ...prev, [tabId]: { ...(prev[tabId] ?? EMPTY_SESSION), ...patch } }));
}

function dispatch(tabId: string, mode: FindRequestMode, query: string) {
  requests$.set(prev => {
    const seq = (prev[tabId]?.seq ?? 0) + 1;
    return { ...prev, [tabId]: { query, mode, seq } };
  });
}

const open = (tabId: string) => {
  // Bump openSeq on every call so re-pressing Cmd+F while the bar is already open
  // still triggers the overlay's focus/select effect (visible: true → true alone
  // would look like a no-op).
  const prevSeq = sessions$.get()[tabId]?.openSeq ?? 0;
  patchSession(tabId, { visible: true, openSeq: prevSeq + 1 });
  // Restore highlights when reopening a bar that already has a term.
  const query = sessions$.get()[tabId]?.query ?? '';
  if (query) dispatch(tabId, 'search', query);
};

const close = (tabId: string) => {
  patchSession(tabId, { visible: false });
  dispatch(tabId, 'stop', '');
};

const setQuery = (tabId: string, query: string) => {
  if (query) {
    patchSession(tabId, { query });
    dispatch(tabId, 'search', query);
  } else {
    patchSession(tabId, { query: '', matches: 0, activeMatchOrdinal: 0 });
    dispatch(tabId, 'stop', '');
  }
};

// Step gating: visibility AND query. `close()` intentionally keeps `query` so a
// later `open()` can restore highlights; without the visibility check Cmd+G would
// repaint highlights on a page with no bar on screen.
const stepNext = (tabId: string) => {
  const session = sessions$.get()[tabId];
  if (!session?.visible || !session.query) return;
  dispatch(tabId, 'next', session.query);
};

const stepPrev = (tabId: string) => {
  const session = sessions$.get()[tabId];
  if (!session?.visible || !session.query) return;
  dispatch(tabId, 'prev', session.query);
};

const reportResult = (tabId: string, result: { matches: number; activeMatchOrdinal: number }) => {
  patchSession(tabId, { matches: result.matches, activeMatchOrdinal: result.activeMatchOrdinal });
};

// Re-run the active search against freshly-loaded content. Navigation/reload drops
// the guest's native find state, so counts and highlights must be rebuilt — zeroing
// alone would leave the bar stuck at 0/0 with the term still typed. No-op when the
// bar is closed (nothing is highlighted to rebuild).
const rehighlight = (tabId: string) => {
  const session = sessions$.get()[tabId];
  if (!session?.visible) return;
  patchSession(tabId, { matches: 0, activeMatchOrdinal: 0 });
  if (session.query) dispatch(tabId, 'search', session.query);
};

const clear = (tabId: string) => {
  sessions$.set(prev => dropKey(prev, tabId));
  requests$.set(prev => dropKey(prev, tabId));
};

export const findInPage = {
  sessions$,
  requests$,
  open,
  close,
  setQuery,
  stepNext,
  stepPrev,
  reportResult,
  rehighlight,
  clear,
};
