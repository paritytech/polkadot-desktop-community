import { describe, expect, it, vi } from 'vitest';

import { chainRegistry, customChainUseCase } from '@/domains/network';

const GENESIS_HEX = '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3';
const GENESIS_BYTES = Uint8Array.from((GENESIS_HEX.slice(2).match(/../g) ?? []).map(byte => Number.parseInt(byte, 16)));
const UNKNOWN_BYTES = new Uint8Array(32).fill(9);

const relayChain = { chainId: 'relay', genesisHash: GENESIS_HEX, name: 'Polkadot', nodes: [] };

const sendSpy = vi.fn();
const disconnectSpy = vi.fn();
let capturedOnMessage: ((message: unknown) => void) | null = null;

// The registry and the chain catalog are plain objects, spied in place: no socket
// opens, and the callbacks are the only real code on the path.
vi.spyOn(chainRegistry, 'getProvider').mockImplementation(
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the callbacks only send and disconnect
  (() => (onMessage: (message: unknown) => void) => {
    capturedOnMessage = onMessage;

    return { send: sendSpy, disconnect: disconnectSpy };
  }) as unknown as typeof chainRegistry.getProvider,
);
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the callbacks only read genesis hashes
vi.spyOn(customChainUseCase, 'getAllChainsMap').mockResolvedValue({ [GENESIS_HEX]: relayChain } as never);

const { createChainCallbacks } = await import('./chainCallbacks');

describe('createChainCallbacks', () => {
  it('reports a chain the registry knows as supported', async () => {
    const result = { current: createChainCallbacks() };

    await expect(
      result.current.features.featureSupported({ tag: 'Chain', value: { genesisHash: GENESIS_HEX } }),
    ).resolves.toEqual({ supported: true });
  });

  it('reports an unknown chain as unsupported', async () => {
    const result = { current: createChainCallbacks() };

    await expect(result.current.features.featureSupported({ tag: 'Chain', value: { genesisHash: '0xdead' } })).resolves.toEqual({
      supported: false,
    });
  });

  it('rejects connecting to a chain the registry does not know', async () => {
    const result = { current: createChainCallbacks() };

    await expect(result.current.chain.connect(UNKNOWN_BYTES)).rejects.toThrow();
  });

  // polkadot-api emits parsed messages; the core consumes raw strings.
  it('serializes chain responses onto the responses() stream', async () => {
    const result = { current: createChainCallbacks() };
    const connection = await result.current.chain.connect(GENESIS_BYTES);

    const iterator = connection.responses()[Symbol.asyncIterator]();
    const next = iterator.next();
    capturedOnMessage?.({ jsonrpc: '2.0', id: 1, result: '0x1' });

    await expect(next).resolves.toMatchObject({ value: '{"jsonrpc":"2.0","id":1,"result":"0x1"}' });

    connection.close();
  });

  it('parses outbound requests back into objects for polkadot-api', async () => {
    const result = { current: createChainCallbacks() };
    const connection = await result.current.chain.connect(GENESIS_BYTES);

    connection.send('{"jsonrpc":"2.0","id":1,"method":"chain_getHead"}');
    await vi.waitFor(() => expect(sendSpy).toHaveBeenCalled());

    expect(sendSpy).toHaveBeenCalledWith({ jsonrpc: '2.0', id: 1, method: 'chain_getHead' });

    connection.close();
  });

  // Closing while a consumer is parked on `responses()` must END the stream, not hand
  // it one more value. Releasing the waiter with an empty string looked like a reply,
  // and the core would have delivered it to a subscription as a JSON-RPC response.
  it('ends the responses() stream when closed while a consumer is waiting', async () => {
    const result = { current: createChainCallbacks() };
    const connection = await result.current.chain.connect(GENESIS_BYTES);

    const iterator = connection.responses()[Symbol.asyncIterator]();
    const next = iterator.next();

    connection.close();

    await expect(next).resolves.toMatchObject({ done: true, value: undefined });
  });

  it('closes the underlying provider connection', async () => {
    const result = { current: createChainCallbacks() };
    const connection = await result.current.chain.connect(GENESIS_BYTES);

    connection.close();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
