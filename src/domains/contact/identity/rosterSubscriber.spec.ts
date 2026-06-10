import { type Statement } from '@novasamatech/sdk-statement';
import { type StatementStoreAdapter } from '@novasamatech/statement-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TopicFilter = { matchAll: Uint8Array[] } | { matchAny: Uint8Array[] };
type StatementsPage = { statements: Statement[]; isComplete: boolean };

import { subscriptionRegistry } from '@/domains/chat';

import { DeviceRosterEvent } from './device-event-codec';
import { type contactRepository as defaultContactRepository } from './repository';
import { startRosterSubscriber } from './rosterSubscriber';
import { type Contact } from './types';

const accountIdHex = (fill: number) => `0x${fill.toString(16).padStart(2, '0').repeat(32)}`;

const makeContact = (fill: number, devices: Contact['devices'] = []): Contact => ({
  accountId: accountIdHex(fill),
  identityChatPublicKey: '0x' + '04'.repeat(65),
  devices,
  lastUpdate: 0,
});

type CapturedSubscriber = {
  filter: TopicFilter;
  emit: (page: StatementsPage) => void;
  unsubscribed: boolean;
};

const makeStatementStoreCapturing = (cap: { current: CapturedSubscriber | null }): StatementStoreAdapter => {
  const adapter: StatementStoreAdapter = {
    queryStatements: vi.fn(),
    submitStatement: vi.fn(),
    subscribeStatements: vi.fn((filter: TopicFilter, callback: (page: StatementsPage) => unknown) => {
      cap.current = {
        filter,
        emit: page => {
          callback(page);
        },
        unsubscribed: false,
      };
      return () => {
        if (cap.current) cap.current.unsubscribed = true;
      };
    }),
  };
  return adapter;
};

const inMemoryContactRepo = (initial: Contact[] = []): typeof defaultContactRepository => {
  const store = new Map<string, Contact>();
  for (const c of initial) store.set(c.accountId, c);
  return {
    get: vi.fn().mockImplementation((id: string) => Promise.resolve(store.get(id))),
    list: vi.fn().mockImplementation(() => Promise.resolve([...store.values()])),
    listChangedSince: vi
      .fn()
      .mockImplementation((t: number) => Promise.resolve([...store.values()].filter(c => c.lastUpdate > t))),
    upsert: vi.fn().mockImplementation((c: Contact) => {
      store.set(c.accountId, c);
      return Promise.resolve();
    }),
    delete: vi.fn().mockImplementation((id: string) => {
      store.delete(id);
      return Promise.resolve();
    }),
    applyRemoteDelete: vi.fn().mockImplementation((id: string) => {
      store.delete(id);
      return Promise.resolve();
    }),
    listRemovalsSince: vi.fn().mockImplementation(() => Promise.resolve([])),
    clearAll: vi.fn().mockImplementation(() => {
      store.clear();
      return Promise.resolve();
    }),
  };
};

const sr25519Proof = (signerFill: number): Statement['proof'] => ({
  type: 'sr25519',
  value: {
    signature: '0x' + 'aa'.repeat(64),
    signer: '0x' + signerFill.toString(16).padStart(2, '0').repeat(32),
  },
});

const deviceAddedStmt = (signerFill: number, deviceFill: number): Statement => {
  const event: ReturnType<typeof DeviceRosterEvent.dec> = {
    tag: 'DeviceAdded',
    value: {
      statementAccountId: new Uint8Array(32).fill(deviceFill),
      encryptionPublicKey: new Uint8Array(65).fill(0x04),
    },
  };
  return { proof: sr25519Proof(signerFill), data: DeviceRosterEvent.enc(event) };
};

const deviceRemovedStmt = (signerFill: number, deviceFill: number): Statement => {
  const event: ReturnType<typeof DeviceRosterEvent.dec> = {
    tag: 'DeviceRemoved',
    value: { statementAccountId: new Uint8Array(32).fill(deviceFill) },
  };
  return { proof: sr25519Proof(signerFill), data: DeviceRosterEvent.enc(event) };
};

afterEach(() => {
  subscriptionRegistry.reset();
  vi.restoreAllMocks();
});

describe('startRosterSubscriber', () => {
  let cap: { current: CapturedSubscriber | null };

  beforeEach(() => {
    cap = { current: null };
  });

  it('returns a no-op unsubscribe when there are no contacts', () => {
    const adapter = makeStatementStoreCapturing(cap);
    const stop = startRosterSubscriber({ statementStore: adapter, contacts: [], contactRepository: inMemoryContactRepo() });

    expect(adapter.subscribeStatements).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('subscribes with matchAny across roster topics for every known contact', () => {
    const contacts = [makeContact(0xa1), makeContact(0xa2), makeContact(0xa3)];
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts, contactRepository: inMemoryContactRepo() });

    expect(adapter.subscribeStatements).toHaveBeenCalledOnce();
    expect(cap.current).not.toBeNull();
    expect('matchAny' in cap.current!.filter).toBe(true);
    if ('matchAny' in cap.current!.filter) {
      expect(cap.current!.filter.matchAny).toHaveLength(3);
    }
  });

  it('applies a DeviceAdded event signed by the matching contact', async () => {
    const contact = makeContact(0xa1);
    const repo = inMemoryContactRepo([contact]);
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts: [contact], contactRepository: repo });

    cap.current!.emit({ statements: [deviceAddedStmt(0xa1, 0xbb)], isComplete: false });
    await new Promise(r => setTimeout(r, 0));

    expect(repo.upsert).toHaveBeenCalledOnce();
    const updated = vi.mocked(repo.upsert).mock.calls[0]?.[0];
    expect(updated?.devices.map(d => d.statementAccountId)).toEqual([`0x${'bb'.repeat(32)}`]);
  });

  it('applies DeviceRemoved by removing the matching device', async () => {
    const existing = { statementAccountId: `0x${'bb'.repeat(32)}`, encryptionPublicKey: '04old' };
    const contact = makeContact(0xa1, [existing]);
    const repo = inMemoryContactRepo([contact]);
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts: [contact], contactRepository: repo });

    cap.current!.emit({ statements: [deviceRemovedStmt(0xa1, 0xbb)], isComplete: false });
    await new Promise(r => setTimeout(r, 0));

    const updated = vi.mocked(repo.upsert).mock.calls[0]?.[0];
    expect(updated?.devices).toEqual([]);
  });

  it('ignores statements signed by an unknown account', async () => {
    const contact = makeContact(0xa1);
    const repo = inMemoryContactRepo([contact]);
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts: [contact], contactRepository: repo });

    cap.current!.emit({ statements: [deviceAddedStmt(0xff, 0xbb)], isComplete: false });
    await new Promise(r => setTimeout(r, 0));

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('ignores statements without an sr25519 proof', async () => {
    const contact = makeContact(0xa1);
    const repo = inMemoryContactRepo([contact]);
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts: [contact], contactRepository: repo });

    cap.current!.emit({
      statements: [
        {
          proof: {
            type: 'ed25519',
            value: { signature: '0x' + 'aa'.repeat(64), signer: '0x' + 'a1'.repeat(32) },
          },
          data: deviceAddedStmt(0xa1, 0xbb).data,
        },
      ],
      isComplete: false,
    });
    await new Promise(r => setTimeout(r, 0));

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('skips malformed payloads without crashing', async () => {
    const contact = makeContact(0xa1);
    const repo = inMemoryContactRepo([contact]);
    const adapter = makeStatementStoreCapturing(cap);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    startRosterSubscriber({ statementStore: adapter, contacts: [contact], contactRepository: repo });
    cap.current!.emit({
      statements: [{ proof: sr25519Proof(0xa1), data: new Uint8Array([0xff, 0xff, 0xff]) }],
      isComplete: false,
    });
    await new Promise(r => setTimeout(r, 0));

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('returns an unsubscribe that tears down the underlying tracked subscription', () => {
    const contact = makeContact(0xa1);
    const adapter = makeStatementStoreCapturing(cap);
    const stop = startRosterSubscriber({
      statementStore: adapter,
      contacts: [contact],
      contactRepository: inMemoryContactRepo(),
    });

    stop();
    expect(cap.current!.unsubscribed).toBe(true);
  });

  it('processes events from multiple contacts in one stream (matchAny dispatches by signer)', async () => {
    const a = makeContact(0xa1);
    const b = makeContact(0xa2);
    const repo = inMemoryContactRepo([a, b]);
    const adapter = makeStatementStoreCapturing(cap);
    startRosterSubscriber({ statementStore: adapter, contacts: [a, b], contactRepository: repo });

    cap.current!.emit({
      statements: [deviceAddedStmt(0xa1, 0xb1), deviceAddedStmt(0xa2, 0xb2)],
      isComplete: false,
    });
    await new Promise(r => setTimeout(r, 0));

    expect(repo.upsert).toHaveBeenCalledTimes(2);
  });
});
