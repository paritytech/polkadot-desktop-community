// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllOutboxRecords, clearOutboxRecord, loadOutboxRecord, saveOutboxRecord } from './repository';
import { type OutboxRecord } from './schemas';

const record: OutboxRecord = {
  batch: [{ messageId: 'm1', bytesHex: '0xdeadbeef', notified: true }],
  coverage: { 'req-1': ['m1'] },
  queue: [{ messageId: 'm2', bytesHex: '0xcafe' }],
};

describe('outbox record persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a record per (user, peer)', () => {
    saveOutboxRecord('user-a', 'peer-1', record);
    expect(loadOutboxRecord('user-a', 'peer-1')).toEqual(record);
    // Different peer / user → isolated.
    expect(loadOutboxRecord('user-a', 'peer-2')).toBeNull();
    expect(loadOutboxRecord('user-b', 'peer-1')).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
  });

  it('drops a non-JSON record, warns, and starts clean', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('p2p-chat-outbox:v1:user-a:peer-1', '{not json');
    expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
    expect(localStorage.getItem('p2p-chat-outbox:v1:user-a:peer-1')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('drops a schema-mismatched record, warns, and starts clean', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('p2p-chat-outbox:v1:user-a:peer-1', JSON.stringify({ batch: 'nope' }));
    expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
    expect(localStorage.getItem('p2p-chat-outbox:v1:user-a:peer-1')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('clearOutboxRecord removes exactly one record', () => {
    saveOutboxRecord('user-a', 'peer-1', record);
    saveOutboxRecord('user-a', 'peer-2', record);
    clearOutboxRecord('user-a', 'peer-1');
    expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
    expect(loadOutboxRecord('user-a', 'peer-2')).toEqual(record);
  });

  it('clearAllOutboxRecords removes only outbox keys', () => {
    saveOutboxRecord('user-a', 'peer-1', record);
    saveOutboxRecord('user-b', 'peer-2', record);
    localStorage.setItem('unrelated-key', 'keep me');
    clearAllOutboxRecords();
    expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
    expect(loadOutboxRecord('user-b', 'peer-2')).toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('keep me');
  });

  it('drops a record with non-hex or odd-length bytes, warns, and starts clean', () => {
    // polkadot-api fromHex does NOT throw on undecodable hex — it silently
    // produces garbage bytes. The schema must reject these at load time or
    // junk would be restored into real statements instead of a clean start.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bytesHex of ['0xZZ', '0xabc']) {
      localStorage.setItem(
        'p2p-chat-outbox:v1:user-a:peer-1',
        JSON.stringify({ batch: [{ messageId: 'm1', bytesHex, notified: false }], coverage: {}, queue: [] }),
      );
      expect(loadOutboxRecord('user-a', 'peer-1')).toBeNull();
      expect(localStorage.getItem('p2p-chat-outbox:v1:user-a:peer-1')).toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('saveOutboxRecord tolerates a throwing localStorage (quota), warns, and does not throw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Persist runs after irreversible effects (a successful submit) — a
    // storage failure must never reject the op chain.
    expect(() => saveOutboxRecord('user-a', 'peer-1', record)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    setItem.mockRestore();
  });
});
