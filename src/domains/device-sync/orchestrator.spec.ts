import 'fake-indexeddb/auto';

import { p256 } from '@noble/curves/nist.js';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startDeviceSyncOrchestrator } from './orchestrator';
import { deviceSyncDatabase, deviceSyncRepository } from './repository';

// Count live RTCPeerConnection constructions so a test can assert respawns.
let liveRtcCount = 0;

// Mock RTCPeerConnection so the orchestrator can construct PeerConnections
class FakeRtc extends EventTarget {
  localDescription = null;
  remoteDescription = null;
  signalingState: RTCSignalingState = 'stable';
  iceConnectionState: RTCIceConnectionState = 'new';
  // The data channel stays 'connecting' and never fires 'open' — modelling a
  // stalled handshake (initiator sent an Offer, no usable Answer ever arrives).
  createDataChannel = vi.fn(() => ({
    label: 'sync',
    readyState: 'connecting',
    addEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
  }));
  createOffer = vi.fn(() => Promise.resolve({ type: 'offer' as const, sdp: 'fake' }));
  createAnswer = vi.fn(() => Promise.resolve({ type: 'answer' as const, sdp: 'fake' }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();

  constructor() {
    super();
    liveRtcCount++;
  }
}

// A real p256 keypair so createDeviceSessionChannel's getSharedSecret succeeds
// for a non-self peer (the only way an actual signaler + PC gets spawned).
const PEER_ENC_PRIV = new Uint8Array(32).fill(0x20);
const PEER_ENC_PUB = p256.getPublicKey(PEER_ENC_PRIV, false);

// Own-device keys must also be a real p256 pair now: the orchestrator
// validates every encryptionPublicKey it seeds/spawns and skips non-points.
const OWN_ENC_PRIV = new Uint8Array(32).fill(0x10);
const OWN_ENC_PUB = p256.getPublicKey(OWN_ENC_PRIV, false);

beforeEach(async () => {
  liveRtcCount = 0;
  // @ts-expect-error global injection for test
  globalThis.RTCPeerConnection = FakeRtc;
  await deviceSyncDatabase.knownUserDevices.clear();
});

describe('startDeviceSyncOrchestrator', () => {
  it('seeds knownUserDevices from the initial peer list (self entry seeded too — filtering happens at active-peers query)', async () => {
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      // Only the self entry — keeps getSharedSecret out of the way; that path is
      // covered by signaler / device-session unit tests.
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x01),
            encryptionPublicKey: OWN_ENC_PUB,
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    const stored = await deviceSyncRepository.list();
    expect(stored.length).toBe(1);
    expect(stored[0]?.status).toBe('active');

    // Self is excluded from listActivePeers, so no peer signalers are spawned.
    const active = await deviceSyncRepository.listActivePeers(stored[0]!.statementAccountId);
    expect(active).toHaveLength(0);

    handle.stop();
  });

  it('skips seeding a peer whose encryptionPublicKey is not a P-256 point (host-papp 0.8.6 SSO shared secret regression)', async () => {
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      // A 32-byte blob in place of a key — exactly what host-papp ≥0.8.6's
      // `remoteAccount.publicKey` carries. Must not be persisted or spawned.
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x02),
            encryptionPublicKey: new Uint8Array(32).fill(0x3b),
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    expect(await deviceSyncRepository.list()).toHaveLength(0);
    expect(liveRtcCount).toBe(0);

    handle.stop();
  });

  it('purges a persisted peer row whose encryptionPublicKey is invalid and still spawns the valid peer', async () => {
    // Poisoned row from an earlier build (SSO shared secret stored as a key).
    await deviceSyncRepository.upsert({
      statementAccountId: '0x' + '3b'.repeat(32),
      encryptionPublicKey: '0x' + '3b'.repeat(32),
      status: 'active',
      lastUpdate: Date.now(),
      outgoingUpdateTime: 0,
    });

    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x02),
            encryptionPublicKey: PEER_ENC_PUB,
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    // The poisoned row is gone (so chat fanout can't ship it either)…
    const stored = await deviceSyncRepository.list();
    expect(stored.map(d => d.statementAccountId)).toEqual(['0x' + '02'.repeat(32)]);
    // …and the valid peer still got a connection (one bad row must not take
    // down sync for everyone — the old behavior threw out of the whole start).
    expect(liveRtcCount).toBe(1);

    handle.stop();
  });

  it('returns a handle whose stop() is callable without active peers', async () => {
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () => Promise.resolve([]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    expect(typeof handle.stop).toBe('function');
    handle.stop();
  });

  it('sends a restart-recovery signal on first spawn when a peer has a persisted lastOfferId', async () => {
    // own (0x05) > peer (0x02) → Desktop is the ACCEPTOR, so its signaler sends
    // NOTHING on spawn — the only statement posted is the restart-recovery
    // Reconnected, which lets us assert the recovery fired without decrypting.
    const peerHex = '0x' + '02'.repeat(32);
    await deviceSyncRepository.upsert({
      statementAccountId: peerHex,
      encryptionPublicKey: '0x' + Buffer.from(PEER_ENC_PUB).toString('hex'),
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
      lastOfferId: 'persisted-attempt',
    });

    const postStatement = vi.fn(async () => {});
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x05),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () =>
        Promise.resolve([{ statementAccountId: new Uint8Array(32).fill(0x02), encryptionPublicKey: PEER_ENC_PUB }]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement,
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    await new Promise(r => setTimeout(r, 50));
    // The acceptor sends nothing on its own; this post is the recovery signal.
    expect(postStatement).toHaveBeenCalled();
    handle.stop();
  });

  it('does not send a restart-recovery signal when the peer has no persisted lastOfferId', async () => {
    const peerHex = '0x' + '02'.repeat(32);
    await deviceSyncRepository.upsert({
      statementAccountId: peerHex,
      encryptionPublicKey: '0x' + Buffer.from(PEER_ENC_PUB).toString('hex'),
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });

    const postStatement = vi.fn(async () => {});
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x05),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () =>
        Promise.resolve([{ statementAccountId: new Uint8Array(32).fill(0x02), encryptionPublicKey: PEER_ENC_PUB }]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement,
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
    });

    await new Promise(r => setTimeout(r, 50));
    // Acceptor with nothing to recover stays silent until it receives an Offer.
    expect(postStatement).not.toHaveBeenCalled();
    handle.stop();
  });

  it('respawns the peer connection when the data channel does not open within the handshake timeout (Android CONNECT_TIMEOUT parity)', async () => {
    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      // own (0x01) < peer (0x02) → Desktop is the initiator for this pair.
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x02),
            encryptionPublicKey: PEER_ENC_PUB,
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
      handshakeTimeoutMs: 80,
    });

    // Exactly one PC right after the initial spawn.
    expect(liveRtcCount).toBe(1);

    // The DC never opens; after ~3 handshake-timeout cycles the orchestrator
    // should have torn down and rebuilt the PC several times.
    await new Promise(r => setTimeout(r, 300));
    const countWhileRunning = liveRtcCount;
    expect(countWhileRunning).toBeGreaterThan(1);

    // stop() must clear the pending handshake timer so respawns cease.
    handle.stop();
    await new Promise(r => setTimeout(r, 200));
    expect(liveRtcCount).toBe(countWhileRunning);
  });

  it('does not spawn or submit when the start signal is already aborted (superseded mid-flight)', async () => {
    const controller = new AbortController();
    controller.abort();
    const postStatement = vi.fn(async () => {});

    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x02),
            encryptionPublicKey: PEER_ENC_PUB,
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement,
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
      signal: controller.signal,
    });

    // A superseded start seeds the repository but never spawns a connection or
    // submits signaling — so it can't race a newer orchestrator on the account.
    expect(liveRtcCount).toBe(0);
    expect(postStatement).not.toHaveBeenCalled();

    handle.stop();
  });

  it('tears down a running orchestrator when the start signal aborts after spawn', async () => {
    const controller = new AbortController();

    const handle = await startDeviceSyncOrchestrator({
      ownDevice: {
        statementAccountId: new Uint8Array(32).fill(0x01),
        encryptionPrivateKey: OWN_ENC_PRIV,
        encryptionPublicKey: OWN_ENC_PUB,
      },
      fetchInitialPeers: () =>
        Promise.resolve([
          {
            statementAccountId: new Uint8Array(32).fill(0x02),
            encryptionPublicKey: PEER_ENC_PUB,
          },
        ]),
      subscribeStatementTopic: () => new Subject<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>().asObservable(),
      postStatement: async () => {},
      resolveConsumerInfo: () => Promise.resolve(null),
      ownUserId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      iceConfig: {},
      handshakeTimeoutMs: 80,
      signal: controller.signal,
    });

    expect(liveRtcCount).toBe(1);

    // Aborting tears the spawned connection down and stops respawn timers — no
    // further PCs are built (equivalent to handle.stop()).
    controller.abort();
    const countAtAbort = liveRtcCount;
    await new Promise(r => setTimeout(r, 200));
    expect(liveRtcCount).toBe(countAtAbort);

    handle.stop();
  });
});
