import { p256 } from '@noble/curves/nist.js';
import { describe, expect, it } from 'vitest';

import { p2pService } from './service';
import { type P2PChatRequest } from './types';

const SECRET_A = new Uint8Array(32).fill(0x01);
const SECRET_B = new Uint8Array(32).fill(0x02);
const SECRET_C = new Uint8Array(32).fill(0x03);

const keypair = (secret: Uint8Array) => ({
  privateKey: secret,
  publicKey: p256.getPublicKey(secret, false),
});

describe('computeSharedSecret', () => {
  it('returns 32 bytes', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    expect(p2pService.computeSharedSecret(alice.privateKey, bob.publicKey)).toHaveLength(32);
  });

  it('is symmetric — ECDH property: alice→bob equals bob→alice', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const aliceShared = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    const bobShared = p2pService.computeSharedSecret(bob.privateKey, alice.publicKey);
    expect(aliceShared).toEqual(bobShared);
  });

  it('different peers yield different shared secrets', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const charlie = keypair(SECRET_C);
    expect(p2pService.computeSharedSecret(alice.privateKey, bob.publicKey)).not.toEqual(
      p2pService.computeSharedSecret(alice.privateKey, charlie.publicKey),
    );
  });

  it('is deterministic', () => {
    const alice = keypair(SECRET_A);
    const bob = keypair(SECRET_B);
    const first = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    const second = p2pService.computeSharedSecret(alice.privateKey, bob.publicKey);
    expect(first).toEqual(second);
  });
});

const request = (direction: P2PChatRequest['direction'], status: P2PChatRequest['status']): P2PChatRequest => ({
  requestId: `${direction}-${status}`,
  peerId: 'peer',
  direction,
  status,
  timestamp: 0,
  userId: 'me',
  lastUpdate: 0,
});

describe('isPendingIncomingRequest', () => {
  it('is true only for pending incoming requests', () => {
    expect(p2pService.isPendingIncomingRequest(request('incoming', 'pending'))).toBe(true);
    expect(p2pService.isPendingIncomingRequest(request('incoming', 'accepted'))).toBe(false);
    expect(p2pService.isPendingIncomingRequest(request('outgoing', 'pending'))).toBe(false);
  });
});

describe('isPendingOutgoingRequest', () => {
  it('is true only for pending outgoing requests', () => {
    expect(p2pService.isPendingOutgoingRequest(request('outgoing', 'pending'))).toBe(true);
    expect(p2pService.isPendingOutgoingRequest(request('outgoing', 'declined'))).toBe(false);
    expect(p2pService.isPendingOutgoingRequest(request('incoming', 'pending'))).toBe(false);
  });
});
