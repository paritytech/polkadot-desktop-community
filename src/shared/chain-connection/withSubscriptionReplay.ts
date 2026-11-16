import { type JsonRpcRequest, isRequest, isResponse } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider } from 'polkadot-api';

function isChainMethod(method: string): boolean {
  return method.startsWith('chain_');
}

function isSubscribeMethod(method: string): boolean {
  if (isChainMethod(method)) return false;
  const m = method.toLowerCase();
  return m.includes('subscribe') && !m.includes('unsubscribe');
}

function isUnsubscribeMethod(method: string): boolean {
  return !isChainMethod(method) && method.toLowerCase().includes('unsubscribe');
}

type ActiveSubscription = {
  id: number | string;
  payload: JsonRpcRequest;
  // The subId currently in use server-side. Equals the consumer's stable subId
  // until the first reconnect, then advances each reconnect cycle.
  currentSubId: string;
};

// `reconnectFor` discriminates the two reasons we'd be holding a pending entry:
//   null    → fresh subscribe; the response carries the consumer's first subId.
//   string  → re-sent subscribe; the response carries a new server subId for
//             the active entry keyed by this consumerSubId.
type PendingSubscription = { payload: JsonRpcRequest; reconnectFor: string | null };

export function withSubscriptionReplay(
  provider: JsonRpcProvider,
  onReconnect: (callback: VoidFunction) => VoidFunction,
): JsonRpcProvider {
  return onMessage => {
    const pendingSubscriptions = new Map<number | string, PendingSubscription>();
    // Confirmed subscriptions keyed by the FIRST subId the consumer received.
    // That key stays stable across reconnects so the consumer's subscription
    // manager (which only ever sees the first subId) keeps routing notifications.
    const activeSubscriptions = new Map<string, ActiveSubscription>();
    // Reverse index for inbound notification translation.
    const currentToConsumer = new Map<string, string>();

    const removeSubscription = (consumerSubId: string): ActiveSubscription | undefined => {
      const sub = activeSubscriptions.get(consumerSubId);
      if (sub === undefined) return undefined;
      activeSubscriptions.delete(consumerSubId);
      currentToConsumer.delete(sub.currentSubId);
      // If a reconnect re-send for this entry is mid-flight, drop the pending
      // record so the eventual response doesn't try to update a removed entry.
      const pending = pendingSubscriptions.get(sub.id);
      if (pending?.reconnectFor === consumerSubId) pendingSubscriptions.delete(sub.id);
      return sub;
    };

    const conn = provider(message => {
      // Subscribe response (string result) — register fresh, or update an
      // existing entry's currentSubId on a re-confirmation after reconnect.
      if (isResponse(message) && message.id != null && 'result' in message && typeof message.result === 'string') {
        const pending = pendingSubscriptions.get(message.id);
        if (pending !== undefined) {
          pendingSubscriptions.delete(message.id);
          const newSubId = message.result;
          if (pending.reconnectFor !== null) {
            const sub = activeSubscriptions.get(pending.reconnectFor);
            if (sub !== undefined) {
              currentToConsumer.delete(sub.currentSubId);
              sub.currentSubId = newSubId;
              currentToConsumer.set(newSubId, pending.reconnectFor);
            }
            // Suppress: the consumer already saw the original response and
            // registered its subscriber under the original subId.
            return;
          }
          activeSubscriptions.set(newSubId, { id: message.id, payload: pending.payload, currentSubId: newSubId });
          currentToConsumer.set(newSubId, newSubId);
        }
        onMessage(message);
        return;
      }

      // A refused subscribe is answered, so a replay must send it again rather
      // than wait on the transport to.
      if (isResponse(message) && message.id != null && 'error' in message) {
        pendingSubscriptions.delete(message.id);
      }

      // Notification: rewrite the server's current subId back to the consumer's
      // stable subId so raw-client's subscription manager routes the event.
      if (isRequest(message)) {
        const params: unknown = message.params;
        if (
          typeof params === 'object' &&
          params !== null &&
          'subscription' in params &&
          typeof params.subscription === 'string'
        ) {
          const consumerSubId = currentToConsumer.get(params.subscription);
          if (consumerSubId !== undefined && consumerSubId !== params.subscription) {
            onMessage({ ...message, params: { ...params, subscription: consumerSubId } });
            return;
          }
        }
      }

      onMessage(message);
    });

    const unsubReconnect = onReconnect(() => {
      // Only confirmed subscriptions are replayed. An unconfirmed subscribe is
      // still owned by the transport underneath — every provider this wraps is
      // built on `getSyncProvider`, whose proxy re-sends its in-flight requests
      // across a reconnect and buffers them until the next one is up — so
      // re-sending it here would put the same subscribe on the wire twice and
      // leave the second, unmatched subId subscribed server-side forever.
      // Its pending entry is kept: the response still has to be recognised.
      // A replayed subscribe the last build never answered is in flight the
      // same way, so it is skipped too.
      for (const [consumerSubId, sub] of activeSubscriptions) {
        if (pendingSubscriptions.get(sub.id)?.reconnectFor === consumerSubId) continue;
        // The server returns a fresh subId, which we map back to the consumer's
        // stable subId. `reconnectFor` keeps these entries apart from the
        // unconfirmed ones already in the map, which all carry null.
        pendingSubscriptions.set(sub.id, { payload: sub.payload, reconnectFor: consumerSubId });
        conn.send(sub.payload);
      }
    });

    return {
      send(message) {
        if (isRequest(message)) {
          const { method, id, params } = message;
          if (isSubscribeMethod(method)) {
            if (id != null) pendingSubscriptions.set(id, { payload: message, reconnectFor: null });
          } else if (isUnsubscribeMethod(method) && Array.isArray(params)) {
            const [consumerSubId, ...rest]: unknown[] = params;
            const sub = typeof consumerSubId === 'string' ? removeSubscription(consumerSubId) : undefined;
            if (sub !== undefined && sub.currentSubId !== consumerSubId) {
              conn.send({ ...message, params: [sub.currentSubId, ...rest] });
              return;
            }
          }
        }
        conn.send(message);
      },

      disconnect() {
        pendingSubscriptions.clear();
        activeSubscriptions.clear();
        currentToConsumer.clear();
        unsubReconnect();
        conn.disconnect();
      },
    };
  };
}
