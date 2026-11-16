import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWsJsonRpcProviderMock = vi.hoisted(() => vi.fn());
// The socket is the boundary; everything above it — `createLazyClient` included — is the
// real thing. The lazy client only ever builds a request function here, and the relay
// call that would use it is mocked below, so nothing reaches the wire. The factory
// replaces every export of the `@/shared/chain-connection` barrel for this spec.
vi.mock('@/shared/chain-connection', () => ({
  createWsJsonRpcProvider: createWsJsonRpcProviderMock,
}));

const uploadMock = vi.hoisted(() => vi.fn());
const createHopClientMock = vi.hoisted(() => vi.fn());
vi.mock('@novasamatech/handoff-service', () => ({
  createHopClient: createHopClientMock,
  uploadFile: uploadMock,
}));

// Deliberately NOT mocking `@/domains/application`: the point of this module is that it
// no longer knows the environment exists. If an env import creeps back in, these tests
// break on the unmocked Remote Config fetch rather than passing quietly.

import { type FileMeta } from '../../session/types';

import { fileTransferGateway } from './gateway';

const META: FileMeta = { type: 'image', mimeType: 'image/png', fileSize: 3, width: 1, height: 1 };

const file = () => new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });

beforeEach(() => {
  createWsJsonRpcProviderMock.mockReset();
  // A `JsonRpcProvider`: called with the message sink, it hands back the connection.
  createWsJsonRpcProviderMock.mockImplementation(() => () => ({ send: vi.fn(), disconnect: vi.fn() }));
  createHopClientMock.mockReset();
  createHopClientMock.mockImplementation(() => ({ submit: vi.fn(), claim: vi.fn(), ack: vi.fn() }));
  uploadMock.mockReset();
  uploadMock.mockResolvedValue({
    isErr: () => false,
    value: { identifier: new Uint8Array([9]), claimTicket: new Uint8Array([8]) },
  });
});

describe('fileTransferGateway.uploadFile', () => {
  it('connects to the endpoints passed in, not to any environment-derived default', async () => {
    const hopEndpoints = ['wss://caller-supplied.example/bulletin'];

    await fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints });

    expect(createWsJsonRpcProviderMock).toHaveBeenCalledWith({ endpoints: hopEndpoints });
  });

  it('stamps nodeEndpoint from the first endpoint so the mobile receiver claims from the same node', async () => {
    const hopEndpoints = ['wss://first.example/bulletin', 'wss://second.example/bulletin'];

    const attachment = await fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints });

    expect(attachment.nodeEndpoint).toBe('wss://first.example/bulletin');
    expect(attachment.identifier).toEqual(new Uint8Array([9]));
    expect(attachment.claimTicket).toEqual(new Uint8Array([8]));
  });

  it('reuses one HOP client per endpoint list and rebuilds when the list changes', async () => {
    const a = ['wss://cache-a.example/bulletin'];
    const b = ['wss://cache-b.example/bulletin'];

    await fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints: a });
    await fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints: a });
    expect(createHopClientMock).toHaveBeenCalledTimes(1);

    await fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints: b });
    expect(createHopClientMock).toHaveBeenCalledTimes(2);
  });

  it('throws with the relay message when the upload fails', async () => {
    uploadMock.mockResolvedValue({ isErr: () => true, error: { message: 'pool full' } });

    await expect(
      fileTransferGateway.uploadFile({ file: file(), meta: META, hopEndpoints: ['wss://err.example/bulletin'] }),
    ).rejects.toThrow('File upload failed: pool full');
  });
});
