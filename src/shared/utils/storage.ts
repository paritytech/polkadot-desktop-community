/**
 * Remove every localStorage key starting with `prefix`. Collects keys first —
 * removing while index-walking `localStorage.key(i)` skips entries.
 */
export function removeLocalStorageKeysByPrefix(prefix: string): void {
  const stale: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
}
