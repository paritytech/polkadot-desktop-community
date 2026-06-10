import { database } from '@/shared/database';

// Per-product binary key/value storage for the product sandbox. Imperative
// (no reactive cache) — the sandbox SDK reads/writes blobs on demand, so this
// is a plain repository surface, not a resource or use case.
async function readEntry(productId: string, key: string): Promise<Uint8Array | undefined> {
  const storage = await database.productLocalStorage.get(productId);
  return storage?.data[key];
}

async function writeEntry(productId: string, key: string, value: Uint8Array): Promise<void> {
  const existing = await database.productLocalStorage.get(productId);

  if (existing) {
    existing.data[key] = value;
    await database.productLocalStorage.put(existing);
  } else {
    await database.productLocalStorage.add({ productId, data: { [key]: value } });
  }
}

async function clearEntry(productId: string, key: string): Promise<void> {
  const existing = await database.productLocalStorage.get(productId);
  if (!existing) return;

  delete existing.data[key];
  await database.productLocalStorage.put(existing);
}

async function clearAllEntries(productId: string): Promise<void> {
  await database.productLocalStorage.delete(productId);
}

export const productLocalStorageRepository = {
  readEntry,
  writeEntry,
  clearEntry,
  clearAllEntries,
};
