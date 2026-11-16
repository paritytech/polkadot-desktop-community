import { type StorageAdapter } from '@novasamatech/storage-adapter';
import { errAsync, okAsync } from 'neverthrow';
import { describe, expect, it, vi } from 'vitest';

import { createMetadataCache } from './createMetadataCache';

function createMockStorage(): StorageAdapter {
  return {
    read: vi.fn(),
    write: vi.fn(() => okAsync(undefined)),
    clear: vi.fn(() => okAsync(undefined)),
    subscribe: vi.fn(() => () => {}),
  };
}

describe('createMetadataCache', () => {
  describe('without storage', () => {
    it('returns null for unknown key', async () => {
      const cache = createMetadataCache();
      const opts = cache.forChain('chain-a');

      expect(await opts.getMetadata!('unknown')).toBeNull();
    });

    it('stores and retrieves metadata in memory', async () => {
      const cache = createMetadataCache();
      const opts = cache.forChain('chain-a');
      const data = new Uint8Array([1, 2, 3]);

      opts.setMetadata!('key1', data);
      expect(await opts.getMetadata!('key1')).toEqual(data);
    });

    it('different chains do not share values', async () => {
      const cache = createMetadataCache();
      const a = cache.forChain('chain-a');
      const b = cache.forChain('chain-b');

      a.setMetadata!('key1', new Uint8Array([1]));

      expect(await a.getMetadata!('key1')).toEqual(new Uint8Array([1]));
      expect(await b.getMetadata!('key1')).toBeNull();
    });
  });

  describe('with storage', () => {
    it('falls back to storage when not in memory', async () => {
      const storage = createMockStorage();
      // Base64 for [10, 20, 30] — btoa(String.fromCharCode(10, 20, 30))
      vi.mocked(storage.read).mockReturnValue(okAsync('ChQe'));

      const cache = createMetadataCache({ storage });
      const opts = cache.forChain('chain-a');

      const result = await opts.getMetadata!('key1');
      expect(result).toEqual(new Uint8Array([10, 20, 30]));
      expect(storage.read).toHaveBeenCalledWith('chain-a:key1');
    });

    it('populates memory on storage hit', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.read).mockReturnValue(okAsync('AQ=='));

      const cache = createMetadataCache({ storage });
      const opts = cache.forChain('chain-a');

      await opts.getMetadata!('key1');
      // Second read should not hit storage
      vi.mocked(storage.read).mockClear();
      const result = await opts.getMetadata!('key1');

      expect(result).toEqual(new Uint8Array([1]));
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('writes to both memory and storage', async () => {
      const storage = createMockStorage();
      const cache = createMetadataCache({ storage });
      const opts = cache.forChain('chain-a');
      const data = new Uint8Array([1, 2, 3]);

      opts.setMetadata!('key1', data);

      // Memory read should succeed without storage
      vi.mocked(storage.read).mockReturnValue(okAsync(null));
      expect(await opts.getMetadata!('key1')).toEqual(data);

      // Storage should have been called with base64
      expect(storage.write).toHaveBeenCalledWith('chain-a:key1', btoa(String.fromCharCode(1, 2, 3)));
    });

    it('returns null when storage returns err', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.read).mockReturnValue(errAsync(new Error('storage failed')));

      const cache = createMetadataCache({ storage });
      const opts = cache.forChain('chain-a');

      expect(await opts.getMetadata!('key1')).toBeNull();
    });

    it('Base64 roundtrip preserves binary data', async () => {
      const storage = createMockStorage();

      // Capture what gets written to storage
      let storedValue: string | null = null;
      vi.mocked(storage.write).mockImplementation((_, value) => {
        storedValue = value;
        return okAsync(undefined);
      });
      vi.mocked(storage.read).mockImplementation(() => okAsync(storedValue));

      const cache = createMetadataCache({ storage });
      const opts = cache.forChain('chain-a');
      const original = new Uint8Array([0, 127, 128, 255]);

      opts.setMetadata!('key1', original);

      // Simulate reading what was written from a fresh cache instance (bypasses memory)
      const cache2 = createMetadataCache({ storage });
      const result = await cache2.forChain('chain-a').getMetadata!('key1');

      expect(result).toEqual(original);
    });
  });
});
