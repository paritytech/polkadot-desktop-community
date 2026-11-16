import { type StorageAdapter } from '@novasamatech/storage-adapter';
import { type createClient } from 'polkadot-api';

type ClientOptions = NonNullable<Parameters<typeof createClient>[1]>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type MetadataCache = {
  forChain(chainId: string): ClientOptions;
};

export function createMetadataCache(options?: { storage?: StorageAdapter }): MetadataCache {
  const memory = new Map<string, Uint8Array>();
  const storage = options?.storage;

  const cacheKey = (chainId: string, key: string) => `${chainId}:${key}`;

  return {
    forChain(chainId) {
      return {
        async getMetadata(key) {
          const k = cacheKey(chainId, key);

          const cached = memory.get(k);
          if (cached) return cached;

          if (storage) {
            const result = await storage.read(k);
            if (result.isOk() && result.value) {
              const bytes = base64ToBytes(result.value);
              memory.set(k, bytes);

              return bytes;
            }
          }

          return null;
        },
        setMetadata(key, metadata) {
          const k = cacheKey(chainId, key);
          memory.set(k, metadata);
          // setMetadata is fire-and-forget by contract; log persist failures.
          storage?.write(k, bytesToBase64(metadata)).orTee(error => {
            console.error(`[metadataCache] failed to persist metadata for ${k}:`, error);
          });
        },
      };
    },
  };
}
