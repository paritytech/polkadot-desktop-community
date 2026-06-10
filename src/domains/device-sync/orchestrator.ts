/**
 * Per-pair WebRTC sync orchestration. Seeds the authorising PApp peer from
 * `fetchInitialPeers()`, then for each active peer spawns a signaler + peer
 * connection + sync state machine. Tears down on `stop()`; respawns on PC
 * `disconnected`/`failed`. PApp is authoritative for the device roster — it
 * arrives over the first `SyncUpdate.Devices` and lands via the applier.
 */

import { fromHex, toHex } from 'polkadot-api/utils';
import { type Observable, auditTime } from 'rxjs';

import { type IceConfigParams, createPeerConnection } from '@/shared/peer-channel';
import { isValidEncryptionPublicKey } from '@/domains/device';
import { createDeviceSessionChannel } from '@/domains/device-session';

import { type ConsumerInfoLookup, applySyncEntities } from './applier';
import { collectChangesSince } from './collector';
import { localSyncSignal$ } from './localChangeSignal';
import { deviceSyncRepository } from './repository';
import { startSignaler } from './signaler';
import { type SyncStateMachineHandle, startSyncStateMachine } from './syncStateMachine';
import { type KnownUserDevice } from './types';

export type DeviceSyncOrchestratorParams = {
  ownDevice: {
    statementAccountId: Uint8Array;
    encryptionPrivateKey: Uint8Array;
    encryptionPublicKey: Uint8Array;
  };
  fetchInitialPeers: () => Promise<{ statementAccountId: Uint8Array; encryptionPublicKey: Uint8Array }[]>;
  subscribeStatementTopic: (topic: Uint8Array) => Observable<{ topic: Uint8Array; data: Uint8Array; signer: Uint8Array }>;
  postStatement: (topic: Uint8Array, data: Uint8Array, channel: Uint8Array) => Promise<void>;
  resolveConsumerInfo: ConsumerInfoLookup;
  /** SS58 of the device statement account (= `session.localAccount.accountId` for V2 sessions).
   * Written into `P2PRoom.userId` so the synced room is found by the chat-list hook,
   * which queries rooms by this same SS58. */
  ownUserId: string;
  iceConfig: IceConfigParams;
  /** Handshake budget before a stalled connection is torn down and rebuilt.
   * Defaults to {@link HANDSHAKE_TIMEOUT_MS}; overridable for tests. */
  handshakeTimeoutMs?: number;
};

// Android parity (`DeviceSyncEngine.CONNECT_TIMEOUT`): bound how long a single
// connection attempt may sit before the DC opens. WebRTC does not reliably
// drive a never-progressed PC to `failed`, so an initiator that sent an Offer
// and never got a usable Answer would otherwise wait forever — the
// `disconnected`/`failed` watch below never fires for it.
const HANDSHAKE_TIMEOUT_MS = 45_000;

export type DeviceSyncOrchestratorHandle = {
  stop: () => void;
};

/** Lexicographic byte compare: the peer with the smaller statement account id is the initiator. */
function isLessThan(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return a.length < b.length;
}

export async function startDeviceSyncOrchestrator(params: DeviceSyncOrchestratorParams): Promise<DeviceSyncOrchestratorHandle> {
  const ownStmtHex = toHex(params.ownDevice.statementAccountId);
  const handshakeTimeoutMs = params.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS;
  const closers: (() => void)[] = [];

  // At most one signaler per peer for the orchestrator's lifetime.
  const activePeerSignalers = new Set<string>();

  // Peers for which we've already sent the restart-recovery `reconnected`
  // signal. Per spec §5.4 `reconnected` is RESTART-ONLY (one per process
  // start), not per attempt — so a handshake-timeout respawn must NOT re-send
  // it. First spawn after process start consults the persisted offerId; every
  // later respawn skips it.
  const reconnectSignalSent = new Set<string>();

  // Active state machines keyed by peer; poked on local writes so changes ship
  // immediately rather than waiting for the next DC reconnect.
  const activeStateMachines = new Map<string, SyncStateMachineHandle>();
  const localChangeSub = localSyncSignal$.pipe(auditTime(50)).subscribe(() => {
    for (const sm of activeStateMachines.values()) sm.poke();
  });
  closers.push(() => localChangeSub.unsubscribe());

  function spawn(peer: KnownUserDevice): void {
    if (activePeerSignalers.has(peer.statementAccountId)) return;
    activePeerSignalers.add(peer.statementAccountId);

    const peerStmtBytes = fromHex(peer.statementAccountId);
    const peerEncBytes = fromHex(peer.encryptionPublicKey);
    const role: 'initiator' | 'acceptor' = isLessThan(params.ownDevice.statementAccountId, peerStmtBytes)
      ? 'initiator'
      : 'acceptor';

    console.info('WEBRTC [orchestrator] spawn peer=%s role=%s', peer.statementAccountId, role);

    const session = createDeviceSessionChannel({
      ourDeviceEncPriv: params.ownDevice.encryptionPrivateKey,
      ourStatementAccountId: params.ownDevice.statementAccountId,
      peerDeviceEncPub: peerEncBytes,
      peerStatementAccountId: peerStmtBytes,
      post: params.postStatement,
      subscribe: params.subscribeStatementTopic,
    });

    const peerConn = createPeerConnection({
      role,
      dataChannelLabel: 'sync',
      iceConfig: params.iceConfig,
    });

    // Restart recovery (spec §5.3-5.4): on the FIRST spawn after process start,
    // if a previous attempt's offerId is persisted, tell the peer to dispose it
    // so both ends start clean instead of waiting out a 45s stale-handshake
    // timeout. The offerId is already loaded on `peer` (from listActivePeers),
    // so we send SYNCHRONOUSLY here — before startSignaler mints/sends its own
    // Offer — guaranteeing the Reconnected is enqueued ahead of the fresh Offer
    // in the session batch (no race between a DB read and createOffer). The
    // send promise is not awaited so `spawn` stays synchronous; the fresh
    // attempt (below) mints its own offerId regardless.
    if (!reconnectSignalSent.has(peer.statementAccountId)) {
      reconnectSignalSent.add(peer.statementAccountId);
      const persistedOfferId = peer.lastOfferId;
      if (persistedOfferId !== undefined) {
        console.info(
          'WEBRTC [orchestrator] restart recovery peer=%s — sending reconnected(offerId=%s)',
          peer.statementAccountId,
          persistedOfferId,
        );
        void session
          .send({ offerId: persistedOfferId, message: { tag: 'Reconnected', value: undefined } })
          .catch(err =>
            console.warn(
              'WEBRTC [orchestrator] reconnected send failed peer=%s: %s',
              peer.statementAccountId,
              err instanceof Error ? err.message : String(err),
            ),
          );
      }
    }

    let respawning = false;
    const signaler = startSignaler({
      session,
      peerConnection: peerConn,
      role,
      onAcceptedOfferId: offerId => {
        void deviceSyncRepository.setLastOfferId(peer.statementAccountId, offerId);
      },
      onResetRequest: () => {
        // Peer asked us (via a matching Reconnected) to dispose this attempt.
        // Clear the persisted offerId (it's dead) and respawn a fresh attempt.
        void deviceSyncRepository.setLastOfferId(peer.statementAccountId, null);
        console.info('WEBRTC [orchestrator] reset requested by peer=%s — respawning', peer.statementAccountId);
        respawnPeer('failed');
      },
    });

    // Per-spawn teardown bag — keeps a PC-death respawn scoped to this peer.
    const spawnClosers: (() => void)[] = [];

    // Android parity (`awaitOpenOrTerminal`): retry on open OR terminal OR
    // timeout. The connectionState$ watch below covers terminal; this covers
    // "stuck in connecting/new" — cleared the moment the DC opens.
    const handshakeTimer = setTimeout(() => {
      console.warn(
        'WEBRTC [orchestrator] handshake timeout (%dms) peer=%s connection=%s — respawning',
        handshakeTimeoutMs,
        peer.statementAccountId,
        peerConn.connectionState(),
      );
      respawnPeer('failed');
    }, handshakeTimeoutMs);
    spawnClosers.push(() => clearTimeout(handshakeTimer));

    const dataChannelSub = signaler.dataChannel$.subscribe({
      next: channel => {
        clearTimeout(handshakeTimer);
        console.info('WEBRTC [orchestrator] data channel ready peer=%s — starting sync state machine', peer.statementAccountId);
        const sm = startSyncStateMachine({
          peerStatementAccountId: peer.statementAccountId,
          dataChannel: channel,
          // Re-read checkpoint from the repository on every pump. Closing over
          // `peer.outgoingUpdateTime` would freeze it at spawn-time and cause
          // an echo loop (Update id=1..N with identical payload).
          collect: async () => {
            const row = await deviceSyncRepository.get(peer.statementAccountId);
            const since = row?.outgoingUpdateTime ?? 0;
            return collectChangesSince(since);
          },
          apply: entities =>
            applySyncEntities(entities, {
              resolveConsumerInfo: params.resolveConsumerInfo,
              ownUserId: params.ownUserId,
            }),
          getOutgoingUpdateTime: async () => {
            const row = await deviceSyncRepository.get(peer.statementAccountId);
            return row?.outgoingUpdateTime ?? 0;
          },
          advanceOutgoingUpdateTime: deviceSyncRepository.advanceOutgoingUpdateTime,
        });
        activeStateMachines.set(peer.statementAccountId, sm);
        spawnClosers.push(() => {
          activeStateMachines.delete(peer.statementAccountId);
          sm.close();
        });
      },
    });
    spawnClosers.push(() => dataChannelSub.unsubscribe());
    spawnClosers.push(() => signaler.close());

    // Respawn the PC on `disconnected`/`failed`. WebRTC reuses the PC on a
    // peer's re-handshake but does NOT re-emit `datachannel` for the peer's
    // fresh DC, so the only reliable recovery is full teardown + rebuild.
    // `disconnected` is sometimes transient — wait 2s; `failed` is terminal.
    let deathTimer: ReturnType<typeof setTimeout> | null = null;
    const respawnSub = peerConn.connectionState$.subscribe({
      next: state => {
        if (state === 'failed') {
          if (deathTimer !== null) {
            clearTimeout(deathTimer);
            deathTimer = null;
          }
          console.warn('WEBRTC [orchestrator] connection FAILED peer=%s — respawning', peer.statementAccountId);
          respawnPeer('failed');
        } else if (state === 'disconnected') {
          if (deathTimer !== null) return;
          console.warn(
            'WEBRTC [orchestrator] connection DISCONNECTED peer=%s — 2s grace before respawn',
            peer.statementAccountId,
          );
          deathTimer = setTimeout(() => {
            deathTimer = null;
            const cur = peerConn.connectionState();
            if (cur === 'disconnected' || cur === 'failed') {
              console.warn('WEBRTC [orchestrator] still %s after grace peer=%s — respawning', cur, peer.statementAccountId);
              respawnPeer(cur);
            } else {
              console.info('WEBRTC [orchestrator] recovered to %s within grace peer=%s', cur, peer.statementAccountId);
            }
          }, 2000);
        } else if (state === 'connected') {
          if (deathTimer !== null) {
            console.info('WEBRTC [orchestrator] reconnected within grace peer=%s — cancelling respawn', peer.statementAccountId);
            clearTimeout(deathTimer);
            deathTimer = null;
          }
        }
      },
    });
    spawnClosers.push(() => respawnSub.unsubscribe());
    spawnClosers.push(() => {
      if (deathTimer !== null) {
        clearTimeout(deathTimer);
        deathTimer = null;
      }
    });

    function respawnPeer(cause: RTCPeerConnectionState): void {
      if (respawning) return;
      respawning = true;
      console.info('WEBRTC [orchestrator] tearing down peer=%s (cause=%s) and respawning', peer.statementAccountId, cause);
      for (const c of spawnClosers) {
        try {
          c();
        } catch (e) {
          console.warn('WEBRTC [orchestrator] spawn closer threw: %s', e instanceof Error ? e.message : String(e));
        }
      }
      activePeerSignalers.delete(peer.statementAccountId);
      spawn(peer);
    }

    closers.push(() => {
      for (const c of spawnClosers) c();
    });
  }

  const initial = await params.fetchInitialPeers();
  const now = Date.now();
  for (const peer of initial) {
    if (!isValidEncryptionPublicKey(peer.encryptionPublicKey)) {
      console.warn(
        'WEBRTC [orchestrator] skipping seed peer=%s — encryptionPublicKey is not a valid P-256 key (len=%d)',
        toHex(peer.statementAccountId),
        peer.encryptionPublicKey.length,
      );
      continue;
    }
    const stmtHex = toHex(peer.statementAccountId);
    const existing = await deviceSyncRepository.get(stmtHex);
    if (!existing) {
      await deviceSyncRepository.upsert({
        statementAccountId: stmtHex,
        encryptionPublicKey: toHex(peer.encryptionPublicKey),
        status: 'active',
        lastUpdate: now,
        outgoingUpdateTime: 0,
      });
    }
  }

  const allPeers = await deviceSyncRepository.listActivePeers(ownStmtHex);
  // Purge rows whose enc key can't serve ECDH — earlier builds persisted
  // host-papp 0.8.6's SSO shared secret as a "key" here, and the chat manager
  // fans these rows out to peers as `deviceAdded` (poisoning THEIR sends too).
  const peers: KnownUserDevice[] = [];
  for (const peer of allPeers) {
    if (isValidEncryptionPublicKey(fromHex(peer.encryptionPublicKey))) {
      peers.push(peer);
      continue;
    }
    console.warn(
      'WEBRTC [orchestrator] purging persisted peer=%s — encryptionPublicKey is not a valid P-256 key',
      peer.statementAccountId,
    );
    await deviceSyncRepository.remove(peer.statementAccountId);
  }
  // Stagger initial spawns. Each signaler synchronously posts its first
  // SDP/ICE bundle to the statement-store at construction time; firing them
  // in parallel saturates the account's per-block submission budget and the
  // chain returns `AccountFullError`, forcing exponential backoff. A small
  // delay between spawns lets the budget recover between Offers.
  const SPAWN_INTERVAL_MS = 600;
  for (let i = 0; i < peers.length; i++) {
    // One bad peer must not take down sync with every other device: spawn()
    // synchronously derives ECDH topics and can throw on corrupt key material.
    try {
      spawn(peers[i]!);
    } catch (e) {
      console.warn(
        'WEBRTC [orchestrator] spawn failed peer=%s — skipping: %s',
        peers[i]!.statementAccountId,
        e instanceof Error ? e.message : String(e),
      );
      activePeerSignalers.delete(peers[i]!.statementAccountId);
    }
    if (i < peers.length - 1) {
      await new Promise<void>(resolve => setTimeout(resolve, SPAWN_INTERVAL_MS));
    }
  }

  return {
    stop: () => {
      for (const c of closers) c();
    },
  };
}
