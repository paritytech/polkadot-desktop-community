import { type Statement } from '@novasamatech/sdk-statement';
import { type StatementStoreAdapter } from '@novasamatech/statement-store';

export const SUBSCRIPTION_BUDGET = 120;

// Mirrors the StatementStoreAdapter.subscribeStatements signature in @novasamatech/statement-store.
// These structural types are not re-exported by the SDK's public entry point.
type TopicFilter = { matchAll: Uint8Array[] } | { matchAny: Uint8Array[] };
type StatementsPage = { statements: Statement[]; isComplete: boolean };
type SubscribeCallback = (page: StatementsPage) => unknown;

const refCounts = new Map<string, number>();

const toHex = (bytes: Uint8Array): string => {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
};

const filterTopics = (filter: TopicFilter): Uint8Array[] => ('matchAll' in filter ? filter.matchAll : filter.matchAny);

const incRef = (topicHex: string): void => {
  refCounts.set(topicHex, (refCounts.get(topicHex) ?? 0) + 1);
  if (refCounts.size > SUBSCRIPTION_BUDGET) {
    console.warn(`statement-store: subscription budget exceeded (${refCounts.size}/${SUBSCRIPTION_BUDGET})`);
  }
};

const decRef = (topicHex: string): void => {
  const cur = refCounts.get(topicHex);
  if (cur === undefined) return;
  if (cur <= 1) {
    refCounts.delete(topicHex);
  } else {
    refCounts.set(topicHex, cur - 1);
  }
};

export const trackedSubscribeStatements = (
  adapter: StatementStoreAdapter,
  filter: TopicFilter,
  callback: SubscribeCallback,
): VoidFunction => {
  const hexes = filterTopics(filter).map(toHex);
  for (const h of hexes) incRef(h);

  const innerUnsub = adapter.subscribeStatements(filter, callback);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    innerUnsub();
    for (const h of hexes) decRef(h);
  };
};

export const subscriptionRegistry = {
  size: (): number => refCounts.size,
  reset: (): void => {
    refCounts.clear();
  },
};
