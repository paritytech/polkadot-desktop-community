import { type Statement } from '@novasamatech/sdk-statement';

type TopicFilter = { matchAll: Uint8Array[] } | { matchAny: Uint8Array[] };
type StatementsPage = { statements: Statement[]; isComplete: boolean };
type SubscribeCallback = (page: StatementsPage) => unknown;
type SubscribeFn = (filter: TopicFilter, callback: SubscribeCallback) => VoidFunction;
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';
type StatusListener = (status: ConnectionStatus) => void;

type Params = {
  inner: SubscribeFn;
  onStatusChanged: (cb: StatusListener) => VoidFunction;
};

type Entry = {
  filter: TopicFilter;
  callback: SubscribeCallback;
  innerUnsub: VoidFunction;
};

// Wraps the inner subscribe so that statement subscriptions survive a chain
// reconnect. The underlying transport's subscription-replay layer re-sends
// the original subscribe payload, but the server assigns a NEW subscription
// id while the substrate-client demuxer is still listening on the old one —
// so notifications after a reconnect are silently dropped. Re-issuing the
// subscribe from this layer creates a fresh subId mapping end-to-end.
export const createReconnectAwareSubscribe = ({ inner, onStatusChanged }: Params) => {
  const entries = new Set<Entry>();
  let sawDisconnect = false;

  const detachStatus = onStatusChanged(status => {
    if (status === 'disconnected') {
      sawDisconnect = true;
      return;
    }
    if (status !== 'connected' || !sawDisconnect) return;
    sawDisconnect = false;

    const snapshot = [...entries];
    for (const entry of snapshot) entry.innerUnsub();
    for (const entry of snapshot) {
      if (entries.has(entry)) {
        entry.innerUnsub = inner(entry.filter, entry.callback);
      }
    }
  });

  const subscribe: SubscribeFn = (filter, callback) => {
    const entry: Entry = { filter, callback, innerUnsub: inner(filter, callback) };
    entries.add(entry);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      entries.delete(entry);
      entry.innerUnsub();
    };
  };

  return { subscribe, dispose: detachStatus };
};
