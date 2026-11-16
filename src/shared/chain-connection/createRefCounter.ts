export function createRefCounter<K>() {
  const refCounter = new Map<K, number>();

  return {
    refs(key: K) {
      return refCounter.get(key) ?? 0;
    },
    increment(key: K) {
      const refs = refCounter.get(key) ?? 0;
      refCounter.set(key, refs + 1);
      return refs + 1;
    },
    decrement(key: K) {
      const refs = refCounter.get(key) ?? 0;
      if (refs === 0) {
        return 0;
      }
      refCounter.set(key, refs - 1);
      return refs - 1;
    },
  };
}
