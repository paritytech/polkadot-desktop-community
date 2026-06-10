/**
 * Peer resolution for P2P chat — username search and P256 key lookup.
 *
 * Uses host-chat's AccountService for username search and direct chain queries
 * for the P256 identifier_key (not yet exposed by host-chat's getConsumerInfo).
 */

import { blake2b } from '@noble/hashes/blake2.js';
import { createAccountService } from '@novasamatech/host-chat';
import { type LazyClient } from '@novasamatech/statement-store';
import { AccountId as AccountIdCodec } from '@polkadot-api/substrate-bindings';
import { fromHex, toHex } from 'polkadot-api/utils';

import { type EnvironmentId, environmentUseCase } from '@/domains/application';

import { type PeerIdentity, type SearchResult } from './types';

/**
 * Construct the storage key for `Resources::Consumers(address)` so we can fall back
 * to a raw `state_getStorage` RPC when papi's typed-API returns `null` (typical when
 * runtime descriptors are out of sync with the deployed runtime — e.g., the V2
 * Consumers record schema has new variants papi doesn't recognise).
 */
const buildResourcesConsumersStorageKey = (addressHex: Uint8Array): string => {
  // twox128("Resources") + twox128("Consumers") + Blake2_128Concat(AccountId)
  const PALLET_PREFIX = '2111e0df19de9563b58301e5f7e00743';
  const STORAGE_PREFIX = '11ab70ef474cf12409dfe509d5efe3b2';
  const keyHash = blake2b(addressHex, { dkLen: 16 });
  const concatTail = toHex(addressHex).slice(2); // strip 0x
  return '0x' + PALLET_PREFIX + STORAGE_PREFIX + toHex(keyHash).slice(2) + concatTail;
};

/**
 * Scan a raw byte buffer for a valid uncompressed P-256 public key (65 bytes
 * starting with 0x04 followed by two 32-byte coords that are non-zero). Returns
 * the first match or null.
 */
const scanForP256UncompressedKey = (bytes: Uint8Array): { offset: number; key: Uint8Array } | null => {
  for (let i = 0; i + 65 <= bytes.length; i++) {
    if (bytes[i] !== 0x04) continue;
    // P-256 uncompressed is 0x04 || X(32) || Y(32). Quick sanity: both coords
    // must be non-zero (an all-zero coord would never be a real key).
    let xNonZero = false;
    let yNonZero = false;
    for (let j = 1; j <= 32; j++)
      if (bytes[i + j] !== 0) {
        xNonZero = true;
        break;
      }
    for (let j = 33; j <= 64; j++)
      if (bytes[i + j] !== 0) {
        yNonZero = true;
        break;
      }
    if (xNonZero && yNonZero) {
      return { offset: i, key: bytes.slice(i, i + 65) };
    }
  }
  return null;
};

const toBytes = (v: unknown): Uint8Array | null => {
  if (v instanceof Uint8Array) return v;
  if (typeof v === 'string') {
    try {
      return fromHex(v.startsWith('0x') ? v : `0x${v}`);
    } catch {
      return null;
    }
  }
  if (Array.isArray(v)) return new Uint8Array(v);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- runtime metadata typing
  const obj = v as any;
  if (obj && typeof obj.asBytes === 'function') return toBytes(obj.asBytes());
  return null;
};

export const createPeerResolver = async (lazyClient: LazyClient, environmentId: EnvironmentId) => {
  const { hostChatNetwork } = await environmentUseCase.getById(environmentId);
  // `hostChatNetwork` is an env-provided string; cast to the SDK's accepted
  // network union (host-chat validates the value at runtime).
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- env string → SDK Network union
  const accountService = createAccountService(hostChatNetwork as Parameters<typeof createAccountService>[0], lazyClient);

  return {
    /**
     * Search for users by username prefix.
     */
    async searchUsers(query: string): Promise<SearchResult[]> {
      const result = await accountService.search(query, 'ASSIGNED');
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    },

    /**
     * Get a peer's P256 public key (identifier_key) from Resources.Consumers on-chain.
     * This is the key peers register during attestation, used for ECDH.
     */
    async getPeerP256Key(address: string): Promise<Uint8Array | null> {
      const client = lazyClient.getClient();
      const api = client.getUnsafeApi();

      // ── Path 1: papi typed-API ─────────────────────────────────────────
      try {
        const raw = await api.query['Resources']?.['Consumers']?.getValue(address);
        if (raw) {
          if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
            (window as any).__lastConsumerLookup = { address, raw };
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- runtime metadata typing
          const r = raw as any;
          const keyCandidate = r['identifier_key'] ?? r['identifierKey'];
          if (keyCandidate !== undefined && keyCandidate !== null) {
            const keyBytes = toBytes(keyCandidate);
            if (keyBytes && keyBytes.length === 65) {
              return keyBytes;
            }
            console.warn(
              '[peer-resolver] papi identifier_key for %s has unexpected shape/length, falling back to raw scan',
              address,
            );
          } else {
            console.warn(
              '[peer-resolver] papi entry for %s has no identifier_key field (keys: %o), falling back to raw scan',
              address,
              Object.keys(r),
            );
          }
        } else {
          console.warn('[peer-resolver] papi Resources.Consumers returned null for %s, falling back to raw RPC', address);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[peer-resolver] papi getValue threw for %s (%s), falling back to raw RPC', address, msg);
      }

      // ── Path 2: raw state_getStorage + scan for P-256 key ──────────────
      // papi descriptors lag behind the runtime — for the V2 Consumers schema
      // the typed-API returns null/undefined even when the chain has data.
      // Bypass the descriptor by fetching the raw SCALE bytes directly and
      // scanning for the first valid uncompressed P-256 pub (0x04 + 32 + 32).
      try {
        const addressBytes = AccountIdCodec().enc(address);
        const storageKey = buildResourcesConsumersStorageKey(addressBytes);
        const request = lazyClient.getRequestFn();
        const hex = await request('state_getStorage', [storageKey]);
        if (!hex || typeof hex !== 'string') {
          console.warn('[peer-resolver] raw state_getStorage returned no value for %s', address);
          return null;
        }
        const rawBytes = fromHex(hex);
        if (typeof window !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions -- debug surface
          (window as any).__lastConsumerRawLookup = { address, storageKey, hex, rawBytes };
        }
        const found = scanForP256UncompressedKey(rawBytes);
        if (!found) {
          console.warn('[peer-resolver] raw bytes for %s contain no valid P-256 pub. raw hex = %s', address, hex);
          return null;
        }
        return found.key;
      } catch (e) {
        console.error('[peer-resolver] raw RPC fallback failed for %s:', address, e);
        return null;
      }
    },

    /**
     * Get a peer's username by their account ID (SS58).
     */
    async getUsername(address: string): Promise<string | null> {
      const result = await accountService.getConsumerInfo(address);
      if (result.isErr() || !result.value) return null;

      return result.value.fullUsername ?? result.value.liteUsername;
    },

    /**
     * Resolve full peer identity: search by username, then get their P256 key.
     */
    async resolvePeer(username: string): Promise<PeerIdentity | null> {
      const results = await this.searchUsers(username);
      if (results.length === 0) return null;

      const first = results.at(0);
      if (!first) return null;

      const identifierKey = await this.getPeerP256Key(first.candidateAccountId);
      if (!identifierKey) return null;

      return {
        accountId: first.candidateAccountId,
        username: first.username,
        identifierKey,
      };
    },
  };
};
