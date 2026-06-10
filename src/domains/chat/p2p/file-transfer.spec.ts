import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@novasamatech/host-substrate-chain-connection', () => ({
  createWsJsonRpcProvider: () => ({ start: vi.fn(), stop: vi.fn() }),
}));
vi.mock('@novasamatech/statement-store', () => ({
  createLazyClient: () => ({ getRequestFn: () => async () => null }),
}));

const downloadMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const createHopClientMock = vi.hoisted(() => vi.fn());
vi.mock('@novasamatech/handoff-service', () => ({
  createHopClient: createHopClientMock,
  downloadFile: downloadMock,
  uploadFile: uploadMock,
}));

vi.mock('@/domains/application', () => ({
  environmentUseCase: {
    getActive: () => ({ id: 'test', bulletinHopEndpoints: ['wss://test.example/bulletin'] }),
  },
}));

import { type FileAttachment } from '../session/types';

import { downloadChatFile } from './file-transfer';
import { p2pChatDatabase } from './repository';

beforeEach(() => {
  downloadMock.mockReset();
  uploadMock.mockReset();
  createHopClientMock.mockReset();
  createHopClientMock.mockImplementation(() => ({
    submit: vi.fn(),
    claim: vi.fn(),
    ack: vi.fn(),
    poolStatus: vi.fn().mockResolvedValue({
      isOk: () => true,
      value: { entryCount: 1, totalBytes: 100, maxBytes: 10_000_000 },
    }),
  }));
});

afterEach(async () => {
  await p2pChatDatabase.downloadedFiles.clear();
});

function makeAttachment(idByte: number): FileAttachment {
  return {
    identifier: new Uint8Array(32).fill(idByte),
    claimTicket: new Uint8Array(32).fill(0xff),
    meta: { type: 'image', mimeType: 'image/jpeg', fileSize: 4, width: 10, height: 10 },
  };
}

describe('downloadChatFile persistence', () => {
  it('persists decrypted bytes to Dexie and serves them on the next call', async () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    downloadMock.mockResolvedValueOnce({ isOk: () => true, value: bytes });

    const attachment = makeAttachment(0xaa);
    const url1 = await downloadChatFile(attachment);
    expect(url1).toMatch(/^blob:/);
    expect(downloadMock).toHaveBeenCalledTimes(1);

    // Persisted entry must exist with the same bytes.
    const hex = 'aa'.repeat(32);
    const row = await p2pChatDatabase.downloadedFiles.get(hex);
    expect(row).toBeDefined();
    expect(row?.mimeType).toBe('image/jpeg');
    expect(Array.from(row?.bytes ?? [])).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it('skips the HOP call when bytes are already persisted', async () => {
    const hex = 'bb'.repeat(32);
    await p2pChatDatabase.downloadedFiles.put({
      identifierHex: hex,
      mimeType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
      downloadedAt: Date.now(),
    });

    const attachment = makeAttachment(0xbb);
    const url = await downloadChatFile(attachment);
    expect(url).toMatch(/^blob:/);
    // Cache hit must not hit the network.
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('caches a "not found" failure in memory so re-mounts do not hammer the server', async () => {
    downloadMock.mockResolvedValue({ isOk: () => false, error: new Error('Data not found') });

    const attachment = makeAttachment(0xcc);
    await expect(downloadChatFile(attachment)).rejects.toThrow(/Data not found/);
    // First call: 4 attempts (initial + 3 retries).
    const firstCallCount = downloadMock.mock.calls.length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // Second call: should fail-fast from the negative cache without re-hitting downloadFile.
    await expect(downloadChatFile(attachment)).rejects.toThrow(/Data not found \(cached\)/);
    expect(downloadMock.mock.calls.length).toBe(firstCallCount);
  });
});
