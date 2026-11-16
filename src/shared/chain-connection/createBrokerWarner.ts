export type BrokerWarner = ReturnType<typeof createBrokerWarner>;

const BROKER_TAG = '[chain-broker]';
// A broken chain repeats one anomaly on every message and would flood the console, so each kind logs its first few,
// then a count at each power of ten.
const WARN_IN_FULL = 3;

// Warns of one chain's anomalies, counted per kind so one broken chain cannot mute another's.
export function createBrokerWarner() {
  const counts = new Map<string, number>();

  function warn(kind: string, message: string): void {
    const count = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, count);
    if (count <= WARN_IN_FULL) {
      console.warn(`${BROKER_TAG} ${message}`);
    } else if (/^10+$/.test(String(count))) {
      console.warn(`${BROKER_TAG} ${kind}: ${String(count)} so far`);
    }
  }

  return warn;
}

export function logBrokerTraffic(...args: unknown[]): void {
  console.debug(BROKER_TAG, ...args);
}
