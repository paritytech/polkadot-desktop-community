import { type SubscriptionMessage } from './brokerMessages';
import { type BrokerWarner } from './createBrokerWarner';

type Params = {
  // Warns once a cap drops events.
  warn: BrokerWarner;
  // Handles one held event once its subscription is known, as if it had just arrived.
  deliver: (message: SubscriptionMessage) => void;
};

const MAX_EARLY_SUBSCRIPTION_TOKENS = 32;
const MAX_EARLY_SUBSCRIPTION_EVENTS_PER_TOKEN = 16;

// The upstream events held by subscription token until an answer names it. Both the tokens and the events per token are
// capped, so a token that never maps holds bounded memory.
export function createEarlySubscriptions({ warn, deliver }: Params) {
  const earlySubscriptions = new Map<string, SubscriptionMessage[]>();

  // Holds `message` for `upstreamToken`, dropping the oldest token's events or this event once a cap is hit.
  function buffer(upstreamToken: string, message: SubscriptionMessage): void {
    let events = earlySubscriptions.get(upstreamToken);
    if (events === undefined) {
      if (earlySubscriptions.size >= MAX_EARLY_SUBSCRIPTION_TOKENS) {
        const oldestToken = earlySubscriptions.keys().next().value;
        if (oldestToken !== undefined) {
          earlySubscriptions.delete(oldestToken);
          warn('early_token_cap', `early-subscription token cap hit; dropping buffered events for oldest token: ${oldestToken}`);
        }
      }
      events = [];
      earlySubscriptions.set(upstreamToken, events);
    }
    if (events.length < MAX_EARLY_SUBSCRIPTION_EVENTS_PER_TOKEN) {
      events.push(message);
    } else {
      warn('early_event_cap', `early-subscription event cap hit; dropping event for token: ${upstreamToken}`);
    }
  }

  // Hands the events held for `upstreamToken` to `deliver` in arrival order, and forgets them.
  function flush(upstreamToken: string): void {
    const events = earlySubscriptions.get(upstreamToken);
    if (events === undefined) {
      return;
    }
    earlySubscriptions.delete(upstreamToken);
    for (const event of events) {
      deliver(event);
    }
  }

  function drop(upstreamToken: string): void {
    earlySubscriptions.delete(upstreamToken);
  }

  function clear(): void {
    earlySubscriptions.clear();
  }

  return {
    buffer,
    flush,
    drop,
    clear,
  };
}
