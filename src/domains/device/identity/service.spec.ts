import { x25519 } from '@noble/curves/ed25519.js';
import { ensureSubstrateSlotSr25519Ready } from '@novasamatech/statement-store';
import { substrateSlotSecretFromSeedBytes } from '@novasamatech/substrate-slot-sr25519-wasm';
import { getPublicKey, secretFromSeed } from '@scure/sr25519';
import { toHex } from 'polkadot-api/utils';
import { beforeAll, describe, expect, it } from 'vitest';

import { deviceIdentityService } from './service';

const { deriveEncryptionPublicKey, deriveStatementAccountPublicKey, isValidEncryptionPublicKey } = deviceIdentityService;

beforeAll(ensureSubstrateSlotSr25519Ready);

const generateStatementAccountSeed = () => substrateSlotSecretFromSeedBytes(crypto.getRandomValues(new Uint8Array(32)));
const generateEncryptionPrivateKey = () => x25519.utils.randomSecretKey();

describe('deriveStatementAccountPublicKey', () => {
  it('is deterministic for a given seed', () => {
    const seed = generateStatementAccountSeed();
    const a = deriveStatementAccountPublicKey(seed);
    const b = deriveStatementAccountPublicKey(seed);

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('reads the canonical schnorrkel secret the core serves', () => {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const canonicalSecret = substrateSlotSecretFromSeedBytes(seed);

    // @scure/sr25519 expands the same seed in the ed25519 encoding; both must name one account.
    expect(toHex(deriveStatementAccountPublicKey(canonicalSecret))).toBe(toHex(getPublicKey(secretFromSeed(seed))));
  });
});

describe('deriveEncryptionPublicKey', () => {
  it('returns a 32-byte X25519 public key', () => {
    const priv = generateEncryptionPrivateKey();
    const pub = deriveEncryptionPublicKey(priv);

    expect(pub.length).toBe(32);
  });

  it('is deterministic for a given private key', () => {
    const priv = generateEncryptionPrivateKey();
    const a = deriveEncryptionPublicKey(priv);
    const b = deriveEncryptionPublicKey(priv);

    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('matches the noble/curves X25519 encoding', () => {
    const priv = generateEncryptionPrivateKey();
    const ours = deriveEncryptionPublicKey(priv);
    const reference = x25519.getPublicKey(priv);

    expect(Buffer.from(ours).equals(Buffer.from(reference))).toBe(true);
  });

  it('agrees with the peer on a shared secret', () => {
    const alicePriv = generateEncryptionPrivateKey();
    const bobPriv = generateEncryptionPrivateKey();

    const aliceSees = x25519.getSharedSecret(alicePriv, deriveEncryptionPublicKey(bobPriv));
    const bobSees = x25519.getSharedSecret(bobPriv, deriveEncryptionPublicKey(alicePriv));

    expect(Buffer.from(aliceSees).equals(Buffer.from(bobSees))).toBe(true);
  });
});

describe('isValidEncryptionPublicKey', () => {
  it('accepts a derived 32-byte key', () => {
    const pub = deriveEncryptionPublicKey(generateEncryptionPrivateKey());

    expect(isValidEncryptionPublicKey(pub)).toBe(true);
  });

  it('rejects a 65-byte key', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(65).fill(0xab))).toBe(false);
  });

  it('rejects a 33-byte value', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(33).fill(7))).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(0))).toBe(false);
  });

  // Deliberate limitation: every 32-byte string is a valid X25519 key, so degenerate
  // ones are caught at agreement time (RFC 7748), not here.
  it('accepts any 32 bytes — validity is enforced at key agreement', () => {
    expect(isValidEncryptionPublicKey(new Uint8Array(32).fill(0xff))).toBe(true);
  });
});
