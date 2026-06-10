import { p256 } from '@noble/curves/nist.js';
import { type SignedStatement, type Statement } from '@novasamatech/sdk-statement';
import {
  type StatementStoreAdapter,
  DataTooLargeError,
  createSr25519Secret,
  deriveSr25519PublicKey,
} from '@novasamatech/statement-store';
import { errAsync, okAsync } from 'neverthrow';
import { toHex } from 'polkadot-api/utils';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createChatPeerSessionV2, isMessageTooLargeError } from './chatSessionV2';
import { type OutboxRecord } from './schemas';
import { type OutboxPort } from './types';

const makeDevice = (entropyFill: number) => {
  const seed = createSr25519Secret(new Uint8Array(32).fill(entropyFill));
  const publicKey = deriveSr25519PublicKey(seed);
  const encPriv = p256.utils.randomSecretKey();
  const encPub = p256.getPublicKey(encPriv, false);
  return { seed, publicKey, encPriv, encPub };
};

const makeUserChatKey = () => {
  const priv = p256.utils.randomSecretKey();
  const pub = p256.getPublicKey(priv, false);
  return { priv, pub };
};

type Sub = { topicsHex: string[]; cb: (page: { statements: Statement[]; isComplete: boolean }) => unknown };

/**
 * In-memory statement store that routes submitted statements to live
 * subscribers by topic (the only fake in this test — crypto, codec, session-id
 * derivation and signing are all real). Delivery is deferred to a microtask so
 * the submit() call stack unwinds before the receiver runs.
 */
const createInMemoryStore = (): { adapter: StatementStoreAdapter; submitted: SignedStatement[] } => {
  const submitted: SignedStatement[] = [];
  const subs: Sub[] = [];
  const filterHex = (filter: { matchAll?: Uint8Array[]; matchAny?: Uint8Array[] }): string[] =>
    (filter.matchAll ?? filter.matchAny ?? []).map(toHex);
  const matches = (filterTopicsHex: string[], stmtTopics: string[] | undefined): boolean =>
    filterTopicsHex.every(t => (stmtTopics ?? []).includes(t));

  const adapter: StatementStoreAdapter = {
    queryStatements: filter => okAsync(submitted.filter(s => matches(filterHex(filter), s.topics))),
    subscribeStatements: (filter, cb) => {
      const sub: Sub = { topicsHex: filterHex(filter), cb };
      subs.push(sub);
      return () => {
        const i = subs.indexOf(sub);
        if (i >= 0) subs.splice(i, 1);
      };
    },
    submitStatement: stmt => {
      // Per-channel replacement, as the real store enforces: one statement
      // per (account, channel); an equal-or-higher expiry supersedes. The
      // tests share one signer per channel, so channel equality suffices.
      if (stmt.channel !== undefined) {
        const existing = submitted.findIndex(s => s.channel === stmt.channel);
        if (existing >= 0) submitted.splice(existing, 1);
      }
      submitted.push(stmt);
      queueMicrotask(() => {
        for (const sub of subs) if (matches(sub.topicsHex, stmt.topics)) sub.cb({ statements: [stmt], isComplete: true });
      });
      return okAsync(undefined);
    },
  };
  return { adapter, submitted };
};

const makeOutboxPort = (initial: OutboxRecord | null = null) => {
  let stored: OutboxRecord | null = initial;
  const port: OutboxPort = {
    load: () => stored,
    save: record => {
      stored = structuredClone(record);
    },
    clear: () => {
      stored = null;
    },
  };
  return {
    port,
    get record() {
      return stored;
    },
  };
};

/** Alice↔Bob keys + session params, so per-test boilerplate stays small. */
const makeActors = () => {
  const alice = makeDevice(0x01);
  const aliceChat = makeUserChatKey();
  const aliceAcct = new Uint8Array(32).fill(0xa1);
  const bob = makeDevice(0x02);
  const bobChat = makeUserChatKey();
  const bobAcct = new Uint8Array(32).fill(0xb2);

  const aliceParams = (store: StatementStoreAdapter) => ({
    identityChatPrivateKey: aliceChat.priv,
    ownIdentityAccountId: aliceAcct,
    ownDeviceStatementAccountId: alice.publicKey,
    ownDeviceEncryptionPrivateKey: alice.encPriv,
    ownDeviceSeed: alice.seed,
    peerIdentityAccountId: bobAcct,
    peerIdentityChatPublicKey: bobChat.pub,
    peerDevices: [{ statementAccountId: bob.publicKey, encryptionPublicKey: bob.encPub }],
    statementStore: store,
  });

  const bobParams = (store: StatementStoreAdapter) => ({
    identityChatPrivateKey: bobChat.priv,
    ownIdentityAccountId: bobAcct,
    ownDeviceStatementAccountId: bob.publicKey,
    ownDeviceEncryptionPrivateKey: bob.encPriv,
    ownDeviceSeed: bob.seed,
    peerIdentityAccountId: aliceAcct,
    peerIdentityChatPublicKey: aliceChat.pub,
    peerDevices: [{ statementAccountId: alice.publicKey, encryptionPublicKey: alice.encPub }],
    statementStore: store,
  });

  return { aliceParams, bobParams };
};

/**
 * Measure the on-wire (post outer-encryption) size of a single-message
 * statement, so budget tests pick thresholds relative to real envelope
 * overhead instead of magic numbers. Deterministic for a fixed text length:
 * messageId (nanoid(12)), requestId (nanoid()), and key sizes are constant.
 */
const measureSingleMessageEnvelope = async (text: string): Promise<number> => {
  const { aliceParams } = makeActors();
  const store = createInMemoryStore();
  const session = createChatPeerSessionV2({
    ...aliceParams(store.adapter),
    outbox: makeOutboxPort().port,
    onSent: () => {},
    onMessage: () => {},
    onDelivered: () => {},
  });
  await session.send({ tag: 'text', value: text });
  session.dispose();
  return store.submitted[0]!.data!.length;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chatSessionV2 delivery acknowledgement', () => {
  it('marks an outgoing message delivered once the peer auto-acks (request → message + ack → delivered)', async () => {
    const store = createInMemoryStore();
    const { aliceParams, bobParams } = makeActors();

    const aliceDelivered = vi.fn();
    const bobMessages = vi.fn();

    const aliceSession = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: aliceDelivered,
    });

    const bobSession = createChatPeerSessionV2({
      ...bobParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: bobMessages,
      onDelivered: () => {},
    });

    const { messageId } = await aliceSession.send({ tag: 'text', value: 'hello bob' });

    await vi.waitFor(() => {
      expect(bobMessages).toHaveBeenCalledTimes(1);
      expect(aliceDelivered).toHaveBeenCalledWith(messageId);
    });

    aliceSession.dispose();
    bobSession.dispose();
  });

  it('batches every unacked message into the latest statement, so an offline peer still receives all of them on catch-up', async () => {
    const store = createInMemoryStore();
    const { aliceParams, bobParams } = makeActors();

    const aliceDelivered = vi.fn();
    const bobMessages = vi.fn<(msg: { messageId: string }) => void>();

    const aliceSession = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: aliceDelivered,
    });

    // Bob is OFFLINE (no session yet). Alice sends two messages; the second
    // submit evicts the first statement from the channel — the surviving
    // statement must therefore carry BOTH messages.
    const first = await aliceSession.send({ tag: 'text', value: 'sent while you were offline (1)' });
    const second = await aliceSession.send({ tag: 'text', value: 'sent while you were offline (2)' });

    // Bob comes online: catch-up query sees only the surviving statement.
    const bobSession = createChatPeerSessionV2({
      ...bobParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: bobMessages,
      onDelivered: () => {},
    });

    await vi.waitFor(() => {
      expect(bobMessages).toHaveBeenCalledTimes(2);
    });
    const receivedIds = bobMessages.mock.calls.map(c => c[0].messageId).sort();
    expect(receivedIds).toEqual([first.messageId, second.messageId].sort());

    // Bob's single ack covers the whole batch — both messages turn delivered.
    await vi.waitFor(() => {
      expect(aliceDelivered).toHaveBeenCalledWith(first.messageId);
      expect(aliceDelivered).toHaveBeenCalledWith(second.messageId);
    });

    aliceSession.dispose();
    bobSession.dispose();
  });
});

describe('chatSessionV2 outbox', () => {
  const TEXT = 'x'.repeat(200);

  // Envelope size is deterministic for a fixed text length (key values don't
  // change ECDH-wrap or AES-GCM output sizes), so one measurement serves
  // every budget-sensitive test in this block.
  let budget: number;
  beforeAll(async () => {
    const single = await measureSingleMessageEnvelope(TEXT);
    budget = single + 100; // one 200-char message fits next to nothing else; two don't
  });

  it('parks a message that would overflow the budget; later sends park FIFO even when they would fit', async () => {
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const outbox = makeOutboxPort();
    const onSent = vi.fn();
    const session = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: () => {},
      maxStatementDataBytes: budget,
    });

    const m1 = await session.send({ tag: 'text', value: TEXT });
    const m2 = await session.send({ tag: 'text', value: TEXT }); // overflow → parked
    // 'tiny' WOULD fit next to m1 — FIFO strictness must park it anyway.
    const m3 = await session.send({ tag: 'text', value: 'tiny' });

    expect(store.submitted).toHaveLength(1);
    expect(store.submitted[0]!.data!.length).toBeLessThanOrEqual(budget);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith(m1.messageId);
    expect(outbox.record?.batch.map(e => e.messageId)).toEqual([m1.messageId]);
    expect(outbox.record?.queue.map(e => e.messageId)).toEqual([m2.messageId, m3.messageId]);

    session.dispose();
  });

  it('rejects a message that alone exceeds the budget and persists nothing for it', async () => {
    const oversize = 'y'.repeat(600); // alone ≈ single-message size + 400 > budget

    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const outbox = makeOutboxPort();
    const session = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: () => {},
      maxStatementDataBytes: budget,
    });

    // Empty batch: the candidate IS the lone message.
    await expect(session.send({ tag: 'text', value: oversize })).rejects.toSatisfy(isMessageTooLargeError);
    expect(store.submitted).toHaveLength(0);
    expect(outbox.record).toBeNull();

    // Non-empty queue (FIFO path): an oversize message must STILL reject —
    // parking it would brick the queue (it can never drain, and FIFO blocks
    // everything behind it).
    const m1 = await session.send({ tag: 'text', value: TEXT });
    const m2 = await session.send({ tag: 'text', value: TEXT }); // parks
    await expect(session.send({ tag: 'text', value: oversize })).rejects.toSatisfy(isMessageTooLargeError);
    expect(outbox.record?.queue.map(e => e.messageId)).toEqual([m2.messageId]);
    expect(outbox.record?.batch.map(e => e.messageId)).toEqual([m1.messageId]);

    session.dispose();
  });

  it('deletes the coverage entry when submit fails, keeps the message batched, and notifies it on the next successful send', async () => {
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const originalSubmit = store.adapter.submitStatement;
    let failNext = true;
    store.adapter.submitStatement = stmt => {
      if (failNext) {
        failNext = false;
        return errAsync(new Error('boom'));
      }
      return originalSubmit(stmt);
    };

    const outbox = makeOutboxPort();
    const onSent = vi.fn();
    const session = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: () => {},
    });

    await expect(session.send({ tag: 'text', value: 'first' }, { messageId: 'm1-fixed' })).rejects.toThrow('boom');
    // Hardening: the failed submission's requestId must not leak.
    expect(outbox.record?.coverage).toEqual({});
    // The message is legitimately unacked — it stays batched, un-notified.
    expect(outbox.record?.batch.map(e => e.messageId)).toEqual(['m1-fixed']);
    expect(outbox.record?.batch[0]?.notified).toBe(false);
    expect(onSent).not.toHaveBeenCalled();

    // Next send carries BOTH messages in one statement; the straggler gets its onSent.
    const m2 = await session.send({ tag: 'text', value: 'second' });
    expect(store.submitted).toHaveLength(1);
    expect(onSent).toHaveBeenCalledWith('m1-fixed');
    expect(onSent).toHaveBeenCalledWith(m2.messageId);
    expect(outbox.record?.batch.map(e => e.notified)).toEqual([true, true]);

    session.dispose();
  });

  it('starts clean when the restored record is undecodable instead of crashing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const outbox = makeOutboxPort({
      // bytesHex: undefined bypasses TypeScript via the cast and causes
      // fromHex(undefined) to throw at restore time — simulating a corrupt
      // localStorage record that passes the lax hexString schema regex but
      // is undecodable (the catch also guards future OutboxPort implementations
      // that may throw for other reasons).
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- test: inject undecodable bytesHex to exercise the defensive catch */
      batch: [{ messageId: 'm1', bytesHex: undefined as unknown as `0x${string}`, notified: false }],
      /* eslint-enable @typescript-eslint/consistent-type-assertions */
      coverage: {},
      queue: [],
    });
    const session = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: () => {},
    });
    expect(warn).toHaveBeenCalled();
    expect(outbox.record).toBeNull(); // cleared, clean start
    // Session still works.
    await session.send({ tag: 'text', value: 'hello' });
    expect(store.submitted).toHaveLength(1);
    session.dispose();
  });

  it('drains parked messages once the peer acks the in-flight batch', async () => {
    const { aliceParams, bobParams } = makeActors();
    const store = createInMemoryStore();
    const outbox = makeOutboxPort();
    const onSent = vi.fn();
    const aliceDelivered = vi.fn();
    const bobMessages = vi.fn();

    const aliceSession = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: aliceDelivered,
      maxStatementDataBytes: budget,
    });

    const m1 = await aliceSession.send({ tag: 'text', value: TEXT });
    const m2 = await aliceSession.send({ tag: 'text', value: TEXT }); // parked
    expect(store.submitted).toHaveLength(1);

    // Bob comes online: catch-up sees [m1], acks → alice's budget frees →
    // drain ships m2 → bob receives it and acks again.
    const bobSession = createChatPeerSessionV2({
      ...bobParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: bobMessages,
      onDelivered: () => {},
    });

    await vi.waitFor(() => {
      expect(onSent).toHaveBeenCalledWith(m2.messageId);
      expect(aliceDelivered).toHaveBeenCalledWith(m1.messageId);
      expect(aliceDelivered).toHaveBeenCalledWith(m2.messageId);
      expect(bobMessages).toHaveBeenCalledTimes(2);
    });
    expect(outbox.record?.queue).toEqual([]);
    expect(outbox.record?.batch).toEqual([]);

    aliceSession.dispose();
    bobSession.dispose();
  });

  it('re-parks on DataTooLarge during drain/send and self-heals on the next send', async () => {
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const originalSubmit = store.adapter.submitStatement;
    // Fail twice: once for the send's own submit, once for the drain retry
    // the parked send schedules. After that the chain "recovers".
    let failures = 2;
    store.adapter.submitStatement = stmt => {
      if (failures > 0) {
        failures -= 1;
        return errAsync(new DataTooLargeError(2100, 2000));
      }
      return originalSubmit(stmt);
    };

    const outbox = makeOutboxPort();
    const onSent = vi.fn();
    const session = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: () => {},
    });

    // Gate passes (default budget), chain refuses → parked, NOT thrown.
    await session.send({ tag: 'text', value: 'hello' }, { messageId: 'net-1' });
    await vi.waitFor(() => {
      expect(outbox.record?.queue.map(e => e.messageId)).toEqual(['net-1']);
    });
    expect(store.submitted).toHaveLength(0);
    expect(outbox.record?.batch).toEqual([]);
    expect(onSent).not.toHaveBeenCalled();

    // Next send FIFO-parks behind net-1 and retries the drain → both ship
    // in ONE statement.
    await session.send({ tag: 'text', value: 'world' }, { messageId: 'net-2' });
    await vi.waitFor(() => {
      expect(onSent).toHaveBeenCalledWith('net-1');
      expect(onSent).toHaveBeenCalledWith('net-2');
      expect(store.submitted).toHaveLength(1);
    });
    expect(outbox.record?.queue).toEqual([]);
    expect(outbox.record?.batch.map(e => e.messageId)).toEqual(['net-1', 'net-2']);

    session.dispose();
  });

  it('restores batch+coverage+queue after a restart; pre-restart acks still mark delivered and the queue drains', async () => {
    const { aliceParams, bobParams } = makeActors();
    const store = createInMemoryStore();
    const outbox = makeOutboxPort(); // SHARED across "restarts"
    const aliceDelivered = vi.fn();
    const onSent = vi.fn();

    // Run 1: m1 ships, m2 parks. Then the app "quits".
    const run1 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: () => {},
      maxStatementDataBytes: budget,
    });
    const m1 = await run1.send({ tag: 'text', value: TEXT });
    const m2 = await run1.send({ tag: 'text', value: TEXT });
    run1.dispose();
    expect(store.submitted).toHaveLength(1);

    // Run 2: same persisted record, same store. The batch must NOT be
    // resubmitted eagerly (its statement survives in the store) and the
    // queue must NOT drain yet — drain always carries the full existing
    // batch, and m1+m2 together exceed the budget.
    const run2 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: aliceDelivered,
      maxStatementDataBytes: budget,
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(store.submitted).toHaveLength(1);

    // Restored state is intact: m1 still batched (notified), m2 still queued.
    expect(outbox.record?.batch.map(e => e.messageId)).toEqual([m1.messageId]);
    expect(outbox.record?.queue.map(e => e.messageId)).toEqual([m2.messageId]);

    // Bob comes online and acks the surviving statement [m1]. The requestId
    // predates the "restart" — restored coverage must still honor it. Then
    // the freed budget drains m2.
    const bobMessages = vi.fn();
    const bobSession = createChatPeerSessionV2({
      ...bobParams(store.adapter),
      outbox: makeOutboxPort().port,
      onSent: () => {},
      onMessage: bobMessages,
      onDelivered: () => {},
    });

    await vi.waitFor(() => {
      expect(aliceDelivered).toHaveBeenCalledWith(m1.messageId);
      expect(onSent).toHaveBeenCalledWith(m2.messageId);
      expect(aliceDelivered).toHaveBeenCalledWith(m2.messageId);
      expect(bobMessages).toHaveBeenCalledTimes(2);
      // Restored notified=true must prevent a second onSent for m1.
      expect(onSent).not.toHaveBeenCalledWith(m1.messageId);
    });

    run2.dispose();
    bobSession.dispose();
  });

  it('resubmits a restored batch whose statement never landed (pre-restart transient submit failure)', async () => {
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const originalSubmit = store.adapter.submitStatement;
    let failing = true;
    store.adapter.submitStatement = stmt => {
      if (failing) return errAsync(new Error('boom'));
      return originalSubmit(stmt);
    };

    const outbox = makeOutboxPort(); // SHARED across "restarts"

    // Run 1: the submit fails transiently — the message stays batched with
    // notified:false (never on a successfully submitted statement).
    const run1 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: () => {},
    });
    await expect(run1.send({ tag: 'text', value: 'lost?' }, { messageId: 'm1-fixed' })).rejects.toThrow('boom');
    run1.dispose();
    expect(store.submitted).toHaveLength(0);
    expect(outbox.record?.batch.map(e => ({ id: e.messageId, notified: e.notified }))).toEqual([
      { id: 'm1-fixed', notified: false },
    ]);

    // Run 2: the network is back. The session-start drain must re-ship the
    // never-landed batch even though the QUEUE is empty — no peer ACK could
    // ever drain it (the peer never saw the statement), and without this the
    // message would sit at `new` until the user happened to send again.
    failing = false;
    const onSent = vi.fn();
    const run2 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: () => {},
    });

    await vi.waitFor(() => {
      expect(store.submitted).toHaveLength(1);
      expect(onSent).toHaveBeenCalledWith('m1-fixed');
    });
    expect(outbox.record?.batch.map(e => e.notified)).toEqual([true]);

    run2.dispose();
  });

  it('drops an undeliverable queue head instead of wedging the queue behind it forever', async () => {
    const { aliceParams } = makeActors();
    const store = createInMemoryStore();
    const originalSubmit = store.adapter.submitStatement;
    // Run 1: the chain always refuses → the message ends up parked with an
    // empty batch (the DataTooLarge safety net + drain rollback).
    let refuse = true;
    store.adapter.submitStatement = stmt => {
      if (refuse) return errAsync(new DataTooLargeError(2100, 2000));
      return originalSubmit(stmt);
    };

    const outbox = makeOutboxPort(); // SHARED across "restarts"
    const run1 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent: () => {},
      onMessage: () => {},
      onDelivered: () => {},
    });
    await run1.send({ tag: 'text', value: TEXT }, { messageId: 'stuck-head' });
    await vi.waitFor(() => {
      expect(outbox.record?.queue.map(e => e.messageId)).toEqual(['stuck-head']);
      expect(outbox.record?.batch).toEqual([]);
    });
    run1.dispose();
    refuse = false;

    // Run 2: the budget is now smaller than the head's alone-size (models a
    // grown peer device roster — each device adds envelope overhead — or a
    // corrected budget constant). The restored head can never ship; strict
    // FIFO must NOT wedge: drop it, surface it, keep the queue alive.
    const onUndeliverable = vi.fn();
    const onSent = vi.fn();
    const run2 = createChatPeerSessionV2({
      ...aliceParams(store.adapter),
      outbox: outbox.port,
      onSent,
      onMessage: () => {},
      onDelivered: () => {},
      onUndeliverable,
      maxStatementDataBytes: 100, // below any single-message envelope
    });

    await vi.waitFor(() => {
      expect(onUndeliverable).toHaveBeenCalledWith('stuck-head');
      expect(outbox.record?.queue).toEqual([]);
    });
    expect(store.submitted).toHaveLength(0);
    expect(onSent).not.toHaveBeenCalled();

    run2.dispose();
  });
});
