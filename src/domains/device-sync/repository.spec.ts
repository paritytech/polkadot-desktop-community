import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { deviceSyncDatabase, deviceSyncRepository } from './repository';

describe('deviceSyncRepository', () => {
  beforeEach(async () => {
    await deviceSyncDatabase.knownUserDevices.clear();
  });

  it('upserts and retrieves a known user device', async () => {
    const device = {
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active' as const,
      lastUpdate: 1000,
      outgoingUpdateTime: 0,
    };
    await deviceSyncRepository.upsert(device);
    const got = await deviceSyncRepository.get('0xaa');
    expect(got).toEqual(device);
  });

  it('lists active devices excluding self', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xself',
      encryptionPublicKey: '0x01',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });
    await deviceSyncRepository.upsert({
      statementAccountId: '0xpeer',
      encryptionPublicKey: '0x02',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });
    await deviceSyncRepository.upsert({
      statementAccountId: '0xremoved',
      encryptionPublicKey: '0x03',
      status: 'removed',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });

    const peers = await deviceSyncRepository.listActivePeers('0xself');
    expect(peers.map(p => p.statementAccountId)).toEqual(['0xpeer']);
  });

  it('updates outgoingUpdateTime atomically', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });
    await deviceSyncRepository.advanceOutgoingUpdateTime('0xaa', 12345);
    const got = await deviceSyncRepository.get('0xaa');
    expect(got?.outgoingUpdateTime).toBe(12345);
  });

  it('does not advance outgoingUpdateTime backwards', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 100,
    });
    await deviceSyncRepository.advanceOutgoingUpdateTime('0xaa', 50);
    const got = await deviceSyncRepository.get('0xaa');
    expect(got?.outgoingUpdateTime).toBe(100);
  });

  it('upsertFromRoster refreshes roster metadata but preserves runtime state (lastOfferId, outgoingUpdateTime)', async () => {
    // A device that has already completed a handshake (offerId persisted) and
    // synced some updates.
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xold',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 777,
      lastOfferId: 'live-offer',
    });

    // PApp re-ships the roster (new lastUpdate / key rotation) — this must NOT
    // wipe the persisted offerId or rewind the sync checkpoint to 0.
    await deviceSyncRepository.upsertFromRoster({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xnew',
      lastUpdate: 2,
    });

    const got = await deviceSyncRepository.get('0xaa');
    expect(got).toEqual({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xnew',
      status: 'active',
      lastUpdate: 2,
      outgoingUpdateTime: 777,
      lastOfferId: 'live-offer',
    });
  });

  it('upsertFromRoster inserts a fresh row (outgoingUpdateTime 0, no offerId) for an unknown device', async () => {
    await deviceSyncRepository.upsertFromRoster({
      statementAccountId: '0xnew',
      encryptionPublicKey: '0xkey',
      lastUpdate: 9,
    });
    const got = await deviceSyncRepository.get('0xnew');
    expect(got).toEqual({
      statementAccountId: '0xnew',
      encryptionPublicKey: '0xkey',
      status: 'active',
      lastUpdate: 9,
      outgoingUpdateTime: 0,
    });
  });

  it('setLastOfferId writes and clears (null) the offerId', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });
    await deviceSyncRepository.setLastOfferId('0xaa', 'offer-1');
    expect((await deviceSyncRepository.get('0xaa'))?.lastOfferId).toBe('offer-1');
    await deviceSyncRepository.setLastOfferId('0xaa', null);
    expect((await deviceSyncRepository.get('0xaa'))?.lastOfferId).toBeUndefined();
  });

  it('serializes concurrent per-row writes — last setLastOfferId wins and a parallel advance is not clobbered', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });

    // Fire several writes WITHOUT awaiting between them — mirrors the
    // orchestrator firing `setLastOfferId(null)` on reset while the immediate
    // respawn fires `setLastOfferId(newId)`, plus a concurrent checkpoint
    // advance. With a naive read-modify-write each call snapshots the same row
    // and the last put clobbers the others' fields.
    await Promise.all([
      deviceSyncRepository.setLastOfferId('0xaa', 'A'),
      deviceSyncRepository.setLastOfferId('0xaa', null),
      deviceSyncRepository.setLastOfferId('0xaa', 'B'),
      deviceSyncRepository.advanceOutgoingUpdateTime('0xaa', 42),
    ]);

    const got = await deviceSyncRepository.get('0xaa');
    // Order-preserving serialization → the last setLastOfferId ('B') wins…
    expect(got?.lastOfferId).toBe('B');
    // …and the parallel advance survives (no cross-field clobber).
    expect(got?.outgoingUpdateTime).toBe(42);
  });

  it('clearAll drains a concurrent in-flight roster write and leaves no zombie row', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
      lastOfferId: 'live',
    });

    // Mirror a re-pair: papp-provider fires `clearAll()` to drop the previous
    // user's peers while the still-alive orchestrator's applier fires
    // `upsertFromRoster` (which re-inserts the row even if it's absent). Without
    // the clear barrier the roster write's read-modify-write can straddle the
    // `.clear()` and re-insert the row — a previous-user zombie that survives
    // the wipe and re-spawns a signaler in the next session.
    await Promise.all([
      deviceSyncRepository.upsertFromRoster({ statementAccountId: '0xaa', encryptionPublicKey: '0xbb', lastUpdate: 2 }),
      deviceSyncRepository.clearAll(),
    ]);

    expect(await deviceSyncRepository.get('0xaa')).toBeUndefined();
    expect(await deviceSyncRepository.list()).toEqual([]);
  });

  it('clearAll lets writes issued AFTER it proceed (no deadlock)', async () => {
    await deviceSyncRepository.upsert({
      statementAccountId: '0xaa',
      encryptionPublicKey: '0xbb',
      status: 'active',
      lastUpdate: 1,
      outgoingUpdateTime: 0,
    });

    const clearing = deviceSyncRepository.clearAll();
    // A write enqueued after the clear chains off the clear barrier and must
    // still resolve once the clear completes.
    const reinsert = deviceSyncRepository.upsert({
      statementAccountId: '0xcc',
      encryptionPublicKey: '0xdd',
      status: 'active',
      lastUpdate: 2,
      outgoingUpdateTime: 0,
    });
    await Promise.all([clearing, reinsert]);

    expect(await deviceSyncRepository.get('0xaa')).toBeUndefined();
    expect((await deviceSyncRepository.get('0xcc'))?.encryptionPublicKey).toBe('0xdd');
  });
});
