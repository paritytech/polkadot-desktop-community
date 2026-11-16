import {
  type JsonRpcConnection,
  type JsonRpcMessage,
  type JsonRpcProvider,
  type JsonRpcRequest,
} from '@polkadot-api/json-rpc-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from './brokerMessages';
import { type ChainBroker, createChainBroker } from './createChainBroker';
import { withSubscriptionReplay } from './withSubscriptionReplay';

// An upstream provider that records what the broker sends and emits what the node would answer.
function createProviderHarness() {
  const sent: JsonRpcRequest[] = [];
  const disconnect = vi.fn();
  let onMessage: ((message: JsonRpcMessage) => void) | null = null;

  const provider: JsonRpcProvider = (listener): JsonRpcConnection => {
    onMessage = listener;
    return {
      send(message) {
        sent.push(message);
      },
      disconnect,
    };
  };

  return {
    provider,
    sent,
    disconnect,
    emit(message: JsonRpcMessage) {
      onMessage?.(message);
    },
  };
}

// Reads a request the broker sent upstream, failing the test when it is missing or lacks a string id or params list.
function readUpstreamRequest(request: JsonRpcRequest | undefined): { id: string; method: string; params: unknown[] } {
  expect(request).toBeDefined();
  if (request === undefined) {
    throw new Error('No upstream request');
  }
  const { id, method }: { id?: unknown; method: string } = request;
  const params: unknown = request.params;
  if (typeof id !== 'string' || !Array.isArray(params)) {
    throw new Error(`Upstream request ${JSON.stringify(request)} has no string id or no params list`);
  }
  return { id, method, params };
}

// Reads the answer a session heard, failing the test when it carries no string result.
function readAnswer(message: unknown): { id: unknown; result: string } {
  if (!isRecord(message) || typeof message['result'] !== 'string') {
    throw new Error(`Session message ${JSON.stringify(message)} carries no string result`);
  }
  return { id: message['id'], result: message['result'] };
}

// Reads the subscription and event name of a subscription message, or undefined for any other message.
function readSubscriptionEvent(message: unknown): { subscription: unknown; event: unknown } | undefined {
  if (!isRecord(message) || !isRecord(message['params'])) {
    return undefined;
  }
  const { subscription, result } = message['params'];
  return { subscription, event: isRecord(result) ? result['event'] : undefined };
}

// The warnings logged while `run` runs.
function collectWarningsDuring(run: VoidFunction): string[] {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    run();
    return warn.mock.calls.map(args => String(args[0]));
  } finally {
    warn.mockRestore();
  }
}

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createChainBroker brokering', () => {
  it('As a session sharing a chain with another, I send a request under my own id and get my own response back', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });

    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'conn-a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'conn-b', onMessage: message => messagesB.push(message) });

    // When
    connectionA.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_header', params: ['token-a', '0xabc'] });
    connectionB.send({ jsonrpc: '2.0', id: 7, method: 'chainHead_v1_header', params: ['token-b', '0xdef'] });

    const upstreamA = readUpstreamRequest(harness.sent[0]);
    const upstreamB = readUpstreamRequest(harness.sent[1]);

    harness.emit({ jsonrpc: '2.0', id: upstreamB.id, result: 'header-b' });
    harness.emit({ jsonrpc: '2.0', id: upstreamA.id, result: 'header-a' });

    // Then
    expect(messagesA).toEqual([{ jsonrpc: '2.0', id: 1, result: 'header-a' }]);
    expect(messagesB).toEqual([{ jsonrpc: '2.0', id: 7, result: 'header-b' }]);
  });

  it('answers each session under its own id', () => {
    // Given two sessions that use the same request id
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'b', onMessage: message => messagesB.push(message) });

    // When both send it and the node answers each
    connectionA.send({ jsonrpc: '2.0', id: 'truapi:1', method: 'system_name' });
    connectionB.send({ jsonrpc: '2.0', id: 'truapi:1', method: 'system_name' });
    const upstreamIds = harness.sent.map(request => request.id);
    harness.emit({ jsonrpc: '2.0', id: upstreamIds[1] ?? null, result: 'node-b' });
    harness.emit({ jsonrpc: '2.0', id: upstreamIds[0] ?? null, result: 'node-a' });

    // Then upstream saw two ids, and each answer reached only its own session under its own id
    expect(upstreamIds).toHaveLength(2);
    expect(upstreamIds[0]).not.toBe(upstreamIds[1]);
    expect(messagesA).toEqual([{ jsonrpc: '2.0', id: 'truapi:1', result: 'node-a' }]);
    expect(messagesB).toEqual([{ jsonrpc: '2.0', id: 'truapi:1', result: 'node-b' }]);
  });

  it('answers a batch and a value without a method with an error', () => {
    // Given a session
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });

    // When it sends a batch and a value without a method
    collectWarningsDuring(() => {
      connection.send(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a batch is the malformed input under test, which `send` does not type
        [{ jsonrpc: '2.0', id: 1, method: 'system_name' }] as unknown as JsonRpcRequest,
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a value without a method is the malformed input under test, which `send` does not type
      connection.send({ jsonrpc: '2.0', id: 2 } as unknown as JsonRpcRequest);
    });

    // Then each is answered with an error and nothing went upstream
    expect(messages).toEqual([
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Batch JSON-RPC is unsupported' } },
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Invalid JSON-RPC request' } },
    ]);
    expect(harness.sent).toEqual([]);
  });

  it("answers a request naming another session's token with an error and sends nothing upstream", () => {
    // Given session a holding a follow token, and session b
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'b', onMessage: message => messagesB.push(message) });
    connectionA.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const token = readAnswer(messagesA[0]).result;
    const sentBefore = harness.sent.length;

    // When b sends a request and an unfollow naming a's token
    collectWarningsDuring(() => {
      connectionB.send({ jsonrpc: '2.0', id: 5, method: 'chainHead_v1_header', params: [token, '0xabc'] });
      connectionB.send({ jsonrpc: '2.0', id: 6, method: 'chainHead_v1_unfollow', params: [token] });
    });

    // Then b hears an error for each, nothing went upstream, and a still holds its token
    expect(messagesB).toEqual([
      { jsonrpc: '2.0', id: 5, error: { code: -32603, message: 'Unknown subscription/token' } },
      { jsonrpc: '2.0', id: 6, error: { code: -32603, message: 'Unknown subscription/token' } },
    ]);
    expect(harness.sent).toHaveLength(sentBefore);
    expect(broker.hasToken(token)).toBe(true);
  });

  it('throws on a duplicate open session id, and accepts the id again once that session disconnects', () => {
    // Given an open session a
    const broker = createChainBroker({ provider: createProviderHarness().provider });
    const connection = broker.connect({ sessionId: 'a', onMessage: () => undefined });

    // When / Then a second a is refused while the first is open, and accepted once it left
    expect(() => broker.connect({ sessionId: 'a', onMessage: () => undefined })).toThrow('Duplicate broker session: a');
    connection.disconnect();
    expect(() => broker.connect({ sessionId: 'a', onMessage: () => undefined })).not.toThrow();
  });

  it('As a session following a chain another session follows, I get my own upstream follow and hear only its events under my own token', () => {
    // Given two sessions on one chain
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'b', onMessage: message => messagesB.push(message) });

    // When both follow, the node answers each follow with its own token and sends an event for the first
    connectionA.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    connectionB.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_follow', params: [true] });
    const followA = readUpstreamRequest(harness.sent[0]);
    const followB = readUpstreamRequest(harness.sent[1]);
    harness.emit({ jsonrpc: '2.0', id: followA.id, result: 'up-a' });
    harness.emit({ jsonrpc: '2.0', id: followB.id, result: 'up-b' });
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-a', result: { event: 'bestBlockChanged', bestBlockHash: '0xb1' } },
    });

    // Then two follows went upstream, and only the first session heard the event, under its own token
    expect(harness.sent.map(request => [request.method, request.params])).toEqual([
      ['chainHead_v1_follow', [true]],
      ['chainHead_v1_follow', [true]],
    ]);
    const localTokenA = readAnswer(messagesA[0]).result;
    expect(messagesA.slice(1)).toEqual([
      {
        jsonrpc: '2.0',
        method: 'chainHead_v1_followEvent',
        params: { subscription: localTokenA, result: { event: 'bestBlockChanged', bestBlockHash: '0xb1' } },
      },
    ]);
    expect(messagesB).toHaveLength(1);
    expect(readAnswer(messagesB[0]).id).toBe(2);
  });

  it("As a session that unpins a block of my follow, I send the unpin upstream under my follow's upstream token and hear the node's answer", () => {
    // Given a session whose follow the node answered and initialized
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const token = readAnswer(messages[0]).result;
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-1', result: { event: 'initialized', finalizedBlockHashes: ['0xf0', '0xf1'] } },
    });

    // When the session unpins two blocks and the node answers
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unpin', params: [token, ['0xf0', '0xf1']] });
    const unpin = readUpstreamRequest(harness.sent.at(-1));
    harness.emit({ jsonrpc: '2.0', id: unpin.id, result: null });

    // Then the unpin went upstream under the follow's upstream token, and the session heard the answer under its id
    expect([unpin.method, unpin.params]).toEqual(['chainHead_v1_unpin', ['up-1', ['0xf0', '0xf1']]]);
    expect(messages.at(-1)).toEqual({ jsonrpc: '2.0', id: 2, result: null });
  });

  it("As a session that unfollows, I send the unfollow upstream and stop hearing my follow's events", () => {
    // Given a session whose follow the node answered
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const token = readAnswer(messages[0]).result;

    // When the session unfollows, and the node sends an event for the follow before it answers the unfollow
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unfollow', params: [token] });
    const unfollow = readUpstreamRequest(harness.sent.at(-1));
    const warnings = collectWarningsDuring(() => {
      harness.emit({
        jsonrpc: '2.0',
        method: 'chainHead_v1_followEvent',
        params: { subscription: 'up-1', result: { event: 'bestBlockChanged', bestBlockHash: '0xb1' } },
      });
    });
    harness.emit({ jsonrpc: '2.0', id: unfollow.id, result: null });

    // Then the unfollow went upstream under the follow's upstream token, and the event reached nobody and warned nothing
    expect([unfollow.method, unfollow.params]).toEqual(['chainHead_v1_unfollow', ['up-1']]);
    expect(warnings).toEqual([]);
    expect(messages.slice(1)).toEqual([{ jsonrpc: '2.0', id: 2, result: null }]);
  });

  it('As a session that disconnects, I have my subscriptions released and the upstream stays warm until the broker disconnects all', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const connection = broker.connect({ sessionId: 'conn-a', onMessage: () => undefined });

    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });

    const upstreamRequest = readUpstreamRequest(harness.sent[0]);
    harness.emit({ jsonrpc: '2.0', id: upstreamRequest.id, result: 'up-a' });

    // When
    connection.disconnect();

    // Then
    const release = readUpstreamRequest(harness.sent[1]);
    expect(release.method).toBe('chainHead_v1_unfollow');
    expect(release.params[0]).toBe('up-a');
    expect(harness.disconnect).not.toHaveBeenCalled();

    // When
    broker.disconnectAll();

    // Then
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
  });

  it('As a session that disconnects while the upstream fails to send my first release, I still have my other subscription released', () => {
    // Given a session holding two follows, and an upstream that throws on the first unfollow
    const sendError = new Error('socket gone');
    const unfollowed: unknown[] = [];
    let onUpstream: (message: JsonRpcMessage) => void = () => undefined;
    const broker = createChainBroker({
      provider: listener => {
        onUpstream = listener;
        return {
          send(message) {
            if (message.method !== 'chainHead_v1_unfollow') {
              return;
            }
            unfollowed.push(message.params);
            if (unfollowed.length === 1) {
              throw sendError;
            }
          },
          disconnect: () => undefined,
        };
      },
    });
    const connection = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    onUpstream({ jsonrpc: '2.0', id: 'broker:0', result: 'up-a' });
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_follow', params: [true] });
    onUpstream({ jsonrpc: '2.0', id: 'broker:1', result: 'up-b' });

    // When / Then
    expect(() => {
      connection.disconnect();
    }).toThrow(sendError);
    expect(unfollowed).toEqual([['up-a'], ['up-b']]);
  });

  it('As a session watching a transaction, I hear an event that arrived before my subscription answer, once it is answered', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'conn-a', onMessage: message => messages.push(message) });

    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x0102'] });

    // When
    const upstreamRequest = readUpstreamRequest(harness.sent[0]);
    harness.emit({
      jsonrpc: '2.0',
      method: 'transactionWatch_v1_watchEvent',
      params: { subscription: 'up-tx', result: { event: 'finalized', block: { hash: '0xabc' } } },
    });

    // Then
    expect(messages).toEqual([]);

    // When
    harness.emit({ jsonrpc: '2.0', id: upstreamRequest.id, result: 'up-tx' });

    // Then
    const response = readAnswer(messages[0]);
    expect(messages[1]).toEqual({
      jsonrpc: '2.0',
      method: 'transactionWatch_v1_watchEvent',
      params: { subscription: response.result, result: { event: 'finalized', block: { hash: '0xabc' } } },
    });
  });

  it('As a session subscribed to the statements another session follows, I hear every statement and the upstream subscription ends only once we both left', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'conn-a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'conn-b', onMessage: message => messagesB.push(message) });

    connectionA.send({ jsonrpc: '2.0', id: 1, method: 'statement_subscribeStatement', params: [{ matchAll: ['0xtopic'] }] });
    connectionB.send({ jsonrpc: '2.0', id: 2, method: 'statement_subscribeStatement', params: [{ matchAll: ['0xtopic'] }] });

    // When
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-stmt' });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[1]).id, result: 'up-stmt' });

    // Then
    const localTokenA = readAnswer(messagesA[0]).result;
    const localTokenB = readAnswer(messagesB[0]).result;
    expect(localTokenA).not.toBe(localTokenB);

    // When
    harness.emit({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: 'up-stmt', result: { event: 'newStatements', data: { statements: [] } } },
    });

    // Then
    expect(messagesA[1]).toEqual({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: localTokenA, result: { event: 'newStatements', data: { statements: [] } } },
    });
    expect(messagesB[1]).toEqual({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: localTokenB, result: { event: 'newStatements', data: { statements: [] } } },
    });

    // When
    connectionA.disconnect();

    // Then
    expect(harness.sent.filter(message => message.method === 'statement_unsubscribeStatement')).toHaveLength(0);

    // When
    connectionB.disconnect();

    // Then
    const releases = harness.sent.filter(message => message.method === 'statement_unsubscribeStatement');
    expect(releases).toHaveLength(1);
    expect(readUpstreamRequest(releases[0]).params[0]).toBe('up-stmt');
  });

  it('As a session sharing a statement subscription, I unsubscribe and the other session keeps hearing statements until it unsubscribes too', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'conn-a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'conn-b', onMessage: message => messagesB.push(message) });

    connectionA.send({ jsonrpc: '2.0', id: 1, method: 'statement_subscribeStatement', params: [{ matchAll: ['0xtopic'] }] });
    connectionB.send({ jsonrpc: '2.0', id: 2, method: 'statement_subscribeStatement', params: [{ matchAll: ['0xtopic'] }] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-stmt' });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[1]).id, result: 'up-stmt' });
    const localTokenA = readAnswer(messagesA[0]).result;
    const localTokenB = readAnswer(messagesB[0]).result;

    // When
    connectionA.send({ jsonrpc: '2.0', id: 10, method: 'statement_unsubscribeStatement', params: [localTokenA] });

    // Then
    expect(messagesA.at(-1)).toEqual({ jsonrpc: '2.0', id: 10, result: true });
    expect(harness.sent.filter(message => message.method === 'statement_unsubscribeStatement')).toHaveLength(0);

    // When
    harness.emit({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: 'up-stmt', result: { event: 'newStatements', data: { statements: [] } } },
    });

    // Then
    expect(messagesA).toHaveLength(2);
    expect(messagesB.at(-1)).toEqual({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: localTokenB, result: { event: 'newStatements', data: { statements: [] } } },
    });

    // When
    connectionB.send({ jsonrpc: '2.0', id: 11, method: 'statement_unsubscribeStatement', params: [localTokenB] });

    // Then
    const release = readUpstreamRequest(harness.sent.at(-1));
    expect(release.method).toBe('statement_unsubscribeStatement');
    expect(release.params[0]).toBe('up-stmt');

    // When
    harness.emit({ jsonrpc: '2.0', id: release.id, result: true });

    // Then
    expect(messagesB.at(-1)).toEqual({ jsonrpc: '2.0', id: 11, result: true });
  });

  it('As a session using the same client id as another, I subscribe to my statements and hear only mine', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesA: JsonRpcMessage[] = [];
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'a', onMessage: message => messagesA.push(message) });
    const connectionB = broker.connect({ sessionId: 'b', onMessage: message => messagesB.push(message) });

    // When
    connectionA.send({
      jsonrpc: '2.0',
      id: 'truapi:1',
      method: 'statement_subscribeStatement',
      params: [{ matchAll: [{ key: 'topic', value: 'a' }] }],
    });
    connectionB.send({
      jsonrpc: '2.0',
      id: 'truapi:1',
      method: 'statement_subscribeStatement',
      params: [{ matchAll: [{ key: 'topic', value: 'b' }] }],
    });

    // Then
    const upstreamA = readUpstreamRequest(harness.sent[0]);
    const upstreamB = readUpstreamRequest(harness.sent[1]);
    expect(upstreamA.id).not.toBe(upstreamB.id);

    // When
    harness.emit({ jsonrpc: '2.0', id: upstreamB.id, result: 'upstream-sub-b' });
    harness.emit({ jsonrpc: '2.0', id: upstreamA.id, result: 'upstream-sub-a' });

    // Then
    const responseA = readAnswer(messagesA[0]);
    const responseB = readAnswer(messagesB[0]);
    expect(responseA.id).toBe('truapi:1');
    expect(responseB.id).toBe('truapi:1');
    expect(responseA.result).not.toBe(responseB.result);

    // When
    harness.emit({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: 'upstream-sub-b', result: { event: 'newStatements', statements: ['b'] } },
    });

    // Then
    expect(messagesA).toHaveLength(1);
    expect(messagesB[1]).toEqual({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: responseB.result, result: { event: 'newStatements', statements: ['b'] } },
    });

    // When
    connectionA.disconnect();

    // Then
    expect(harness.sent.at(-1)).toMatchObject({
      method: 'statement_unsubscribeStatement',
      params: ['upstream-sub-a'],
    });
  });

  it('keeps a statement subscription token across a replayed subscribe', () => {
    // Given a broker over a provider that replays its subscriptions on a reconnect, and a session subscribed through it
    const harness = createProviderHarness();
    let reconnect: VoidFunction = () => undefined;
    const broker = createChainBroker({
      provider: withSubscriptionReplay(harness.provider, callback => {
        reconnect = callback;
        return () => undefined;
      }),
    });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'statement_subscribeStatement', params: [{ matchAll: ['0xtopic'] }] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const localToken = readAnswer(messages[0]).result;

    // When the transport reconnects, the node answers the replayed subscribe with a new token and sends an event on it
    reconnect();
    const replayed = readUpstreamRequest(harness.sent[1]);
    harness.emit({ jsonrpc: '2.0', id: replayed.id, result: 'up-2' });
    harness.emit({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: 'up-2', result: { event: 'newStatements', data: { statements: [] } } },
    });

    // Then the event reached the session under its original local token
    expect(replayed.method).toBe('statement_subscribeStatement');
    expect(messages.slice(1)).toEqual([
      {
        jsonrpc: '2.0',
        method: 'statement_statement',
        params: { subscription: localToken, result: { event: 'newStatements', data: { statements: [] } } },
      },
    ]);
  });

  it('As a session whose follow the node refuses, I hear the refusal under my own id and my next follow asks the node again', () => {
    // Given a session waiting on its follow
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'conn-a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const refusal = { code: -32800, message: 'Too many follows' };

    // When the node refuses it
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, error: refusal });

    // Then the session hears the refusal under its own id
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, error: refusal }]);

    // When the session follows again and the node accepts
    connection.send({ jsonrpc: '2.0', id: 3, method: 'chainHead_v1_follow', params: [true] });
    const refollow = harness.sent.filter(message => message.method === 'chainHead_v1_follow')[1];
    harness.emit({ jsonrpc: '2.0', id: refollow?.id ?? 'missing', result: 'up-2' });

    // Then a fresh follow went upstream and the session got a token for it
    expect(refollow).toBeDefined();
    expect(readAnswer(messages.at(-1)).id).toBe(3);
  });

  it.each([
    {
      kind: 'statement subscription',
      subscribe: 'statement_subscribeStatement',
      params: [{ matchAll: ['0xtopic'] }],
      release: 'statement_unsubscribeStatement',
      upstreamToken: 'up-stmt',
    },
    {
      kind: 'transaction watch',
      subscribe: 'transactionWatch_v1_submitAndWatch',
      params: ['0x0102'],
      release: 'transactionWatch_v1_unwatch',
      upstreamToken: 'up-tx',
    },
  ])(
    'As a session that disconnects before my $kind is answered, I leave no $kind running upstream',
    ({ subscribe, params, release, upstreamToken }) => {
      // Given a subscription in flight
      const harness = createProviderHarness();
      const broker = createChainBroker({ provider: harness.provider });
      const connection = broker.connect({ sessionId: 'conn-a', onMessage: () => undefined });
      connection.send({ jsonrpc: '2.0', id: 1, method: subscribe, params });
      const request = readUpstreamRequest(harness.sent[0]);

      // When the session leaves and only then the node answers
      connection.disconnect();
      harness.emit({ jsonrpc: '2.0', id: request.id, result: upstreamToken });

      // Then the subscription is ended upstream
      expect(harness.sent.filter(message => message.method === release).map(message => message.params)).toEqual([
        [upstreamToken],
      ]);
    },
  );

  it('As a session sharing a statement subscription with one that left before its answer, I keep hearing statements', () => {
    // Given two sessions subscribed with the same filter, the second already answered
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messagesB: JsonRpcMessage[] = [];
    const connectionA = broker.connect({ sessionId: 'conn-a', onMessage: () => undefined });
    const connectionB = broker.connect({ sessionId: 'conn-b', onMessage: message => messagesB.push(message) });
    const subscribe: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'statement_subscribeStatement',
      params: [{ matchAll: ['0xtopic'] }],
    };
    connectionA.send(subscribe);
    connectionB.send(subscribe);
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[1]).id, result: 'up-stmt' });

    // When the first leaves, its answer names the same token, and a statement arrives
    connectionA.disconnect();
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-stmt' });
    harness.emit({
      jsonrpc: '2.0',
      method: 'statement_statement',
      params: { subscription: 'up-stmt', result: { event: 'newStatements', data: { statements: [] } } },
    });

    // Then nothing was released and the survivor heard the statement
    expect(harness.sent.filter(message => message.method === 'statement_unsubscribeStatement')).toEqual([]);
    expect(messagesB).toHaveLength(2);
  });

  it.each(['finalized', 'invalid', 'dropped', 'error'])(
    'As a session whose transaction watch ended with %s, I disconnect and no unwatch goes upstream for it',
    terminal => {
      // Given an answered watch
      const harness = createProviderHarness();
      const broker = createChainBroker({ provider: harness.provider });
      const messages: JsonRpcMessage[] = [];
      const connection = broker.connect({ sessionId: 'conn-a', onMessage: message => messages.push(message) });
      connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x0102'] });
      harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-tx' });

      // When the node ends the watch and the session leaves
      harness.emit({
        jsonrpc: '2.0',
        method: 'transactionWatch_v1_watchEvent',
        params: { subscription: 'up-tx', result: { event: terminal } },
      });
      connection.disconnect();

      // Then the session heard the end, and nothing went upstream for a watch the node already ended
      const localToken = readAnswer(messages[0]).result;
      expect(messages[1]).toEqual({
        jsonrpc: '2.0',
        method: 'transactionWatch_v1_watchEvent',
        params: { subscription: localToken, result: { event: terminal } },
      });
      expect(harness.sent.filter(message => message.method === 'transactionWatch_v1_unwatch')).toEqual([]);
    },
  );

  it('As a session, I unwatch as I hear my transaction finalized and get an unknown subscription error with nothing sent upstream', () => {
    // Given an answered watch whose session unwatches from inside the final event's delivery
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    let localToken = '';
    const connection = broker.connect({
      sessionId: 'a',
      onMessage: message => {
        messages.push(message);
        if ('method' in message && message.method === 'transactionWatch_v1_watchEvent') {
          connection.send({ jsonrpc: '2.0', id: 2, method: 'transactionWatch_v1_unwatch', params: [localToken] });
        }
      },
    });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x0102'] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-tx' });
    localToken = readAnswer(messages[0]).result;

    // When the node ends the watch
    harness.emit({
      jsonrpc: '2.0',
      method: 'transactionWatch_v1_watchEvent',
      params: { subscription: 'up-tx', result: { event: 'finalized', block: { hash: '0xabc', index: 0 } } },
    });

    // Then the unwatch is answered locally after the final event, and the node is not asked to unwatch
    expect(messages.slice(1)).toEqual([
      {
        jsonrpc: '2.0',
        method: 'transactionWatch_v1_watchEvent',
        params: { subscription: localToken, result: { event: 'finalized', block: { hash: '0xabc', index: 0 } } },
      },
      { jsonrpc: '2.0', id: 2, error: { code: -32603, message: 'Unknown subscription/token' } },
    ]);
    expect(harness.sent.filter(message => message.method === 'transactionWatch_v1_unwatch')).toEqual([]);
  });

  it('As a session whose transaction watch already ended, I unwatch it and get an unknown subscription error without an upstream call', () => {
    // Given a watch the node ended with a final event
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'conn-a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x0102'] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-tx' });
    const localToken = readAnswer(messages[0]).result;
    harness.emit({
      jsonrpc: '2.0',
      method: 'transactionWatch_v1_watchEvent',
      params: { subscription: 'up-tx', result: { event: 'finalized' } },
    });

    // When the session unwatches its local token
    connection.send({ jsonrpc: '2.0', id: 2, method: 'transactionWatch_v1_unwatch', params: [localToken] });

    // Then the answer is an error under the request id and nothing is unwatched upstream
    expect(messages.at(-1)).toMatchObject({ jsonrpc: '2.0', id: 2, error: { message: 'Unknown subscription/token' } });
    expect(harness.sent.filter(message => message.method === 'transactionWatch_v1_unwatch')).toEqual([]);
  });

  it('As a session whose transaction is only included in a best block, I keep my watch and my disconnect unwatches it upstream', () => {
    // Given an answered watch
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const connection = broker.connect({ sessionId: 'conn-a', onMessage: () => undefined });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x0102'] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-tx' });

    // When a non-final event arrives and the session leaves
    harness.emit({
      jsonrpc: '2.0',
      method: 'transactionWatch_v1_watchEvent',
      params: { subscription: 'up-tx', result: { event: 'bestChainBlockIncluded', block: { hash: '0xabc', index: 0 } } },
    });
    connection.disconnect();

    // Then
    expect(
      harness.sent.filter(message => message.method === 'transactionWatch_v1_unwatch').map(message => message.params),
    ).toEqual([['up-tx']]);
  });
});

describe('createChainBroker warnings', () => {
  it('As a maintainer, I see an anomaly repeated on every message logged in full a few times, then only as a running count', () => {
    // Given a broker with a session
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    broker.connect({ sessionId: 'conn-a', onMessage: () => undefined });

    // When the upstream answers a thousand requests nobody sent
    const warnings = collectWarningsDuring(() => {
      for (let id = 0; id < 1000; id++) {
        harness.emit({ jsonrpc: '2.0', id: `stray-${String(id)}`, result: null });
      }
    });

    // Then the first three are logged in full, then only the count at each power of ten
    expect(warnings.slice(0, 3)).toEqual([
      '[chain-broker] from upstream: response for unknown id=stray-0',
      '[chain-broker] from upstream: response for unknown id=stray-1',
      '[chain-broker] from upstream: response for unknown id=stray-2',
    ]);
    expect(warnings.slice(3).map(warning => /^\[chain-broker\] \w+: (\d+) so far$/.exec(warning)?.[1])).toEqual([
      '10',
      '100',
      '1000',
    ]);
  });

  it("As a maintainer, I see no warning when the node answers a session's own unpin and the unfollow the broker sends itself", () => {
    // Given a session that unpinned its first block, saw the chain finalize past it, and left before the node answered
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const token = readAnswer(messages[0]).result;
    function emitFollowEvent(result: Record<string, unknown>): void {
      harness.emit({ jsonrpc: '2.0', method: 'chainHead_v1_followEvent', params: { subscription: 'up-1', result } });
    }
    emitFollowEvent({ event: 'initialized', finalizedBlockHashes: ['0xf0'] });
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unpin', params: [token, ['0xf0']] });
    emitFollowEvent({ event: 'newBlock', blockHash: '0xb1', parentBlockHash: '0xf0' });
    emitFollowEvent({ event: 'finalized', finalizedBlockHashes: ['0xb1'], prunedBlockHashes: [] });
    connection.disconnect();
    const releases = harness.sent.filter(
      message => message.method === 'chainHead_v1_unpin' || message.method === 'chainHead_v1_unfollow',
    );

    // When the node answers them
    const warnings = collectWarningsDuring(() => {
      for (const release of releases) {
        harness.emit({ jsonrpc: '2.0', id: release.id ?? null, result: null });
      }
    });

    // Then
    expect(releases.map(release => release.method)).toEqual(['chainHead_v1_unpin', 'chainHead_v1_unfollow']);
    expect(warnings).toEqual([]);
  });

  it('As a maintainer, I am warned when the node refuses a release the broker sent itself', () => {
    // Given a session that followed and left
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const connection = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    connection.disconnect();
    const unfollow = harness.sent.find(message => message.method === 'chainHead_v1_unfollow');

    // When the node refuses the unfollow
    const warnings = collectWarningsDuring(() => {
      harness.emit({
        jsonrpc: '2.0',
        id: unfollow?.id ?? null,
        error: { code: -32602, message: 'Invalid subscription' },
      });
    });

    // Then
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/refused chainHead_v1_unfollow/);
  });

  it('As a maintainer, I see no warning for follow events the node sends before it reads the unfollow the broker sent', () => {
    // Given a follow whose only session left before the node answered, so the broker unfollows it at the answer
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const connection = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    connection.disconnect();
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });

    // When the node still delivers events for that follow
    const warnings = collectWarningsDuring(() => {
      harness.emit({
        jsonrpc: '2.0',
        method: 'chainHead_v1_followEvent',
        params: { subscription: 'up-1', result: { event: 'initialized', finalizedBlockHashes: ['0xf0'] } },
      });
    });

    // Then
    expect(harness.sent.map(message => message.method)).toEqual(['chainHead_v1_follow', 'chainHead_v1_unfollow']);
    expect(warnings).toEqual([]);
  });

  it('As a maintainer, I see no warning when many released watches still deliver events while a follow waits on its answer', () => {
    // Given a follow in flight, and a session that leaves with more watches than the early buffer keeps tokens for
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    broker
      .connect({ sessionId: 'a', onMessage: () => undefined })
      .send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const connection = broker.connect({ sessionId: 'b', onMessage: () => undefined });
    const tokens = Array.from({ length: 33 }, (_, index) => `up-tx-${String(index)}`);
    for (const [index, token] of tokens.entries()) {
      connection.send({ jsonrpc: '2.0', id: index, method: 'transactionWatch_v1_submitAndWatch', params: ['0x01'] });
      harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: token });
    }
    connection.disconnect();

    // When the node still delivers an event for each watch before it reads the unwatches
    const warnings = collectWarningsDuring(() => {
      for (const token of tokens) {
        harness.emit({
          jsonrpc: '2.0',
          method: 'transactionWatch_v1_watchEvent',
          params: { subscription: token, result: { event: 'validated' } },
        });
      }
    });

    // Then each watch was unwatched upstream, and none of its late events was buffered or warned about
    expect(harness.sent.filter(message => message.method === 'transactionWatch_v1_unwatch')).toHaveLength(33);
    expect(warnings).toEqual([]);
  });

  it.each([
    {
      subscribe: 'transactionWatch_v1_submitAndWatch',
      params: ['0x01'],
      release: 'transactionWatch_v1_unwatch',
      releaseResult: null,
      event: 'transactionWatch_v1_watchEvent',
    },
    {
      subscribe: 'statement_subscribeStatement',
      params: [{ matchAll: ['0xtopic'] }],
      release: 'statement_unsubscribeStatement',
      releaseResult: true,
      event: 'statement_statement',
    },
  ])(
    'As a dApp that sends $release, I see no warning and no event the node sent before it read my release',
    ({ subscribe, params, release, releaseResult, event }) => {
      // Given a session that subscribed, then released its subscription, which the node has not answered yet
      const harness = createProviderHarness();
      const broker = createChainBroker({ provider: harness.provider });
      const messages: JsonRpcMessage[] = [];
      const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
      connection.send({ jsonrpc: '2.0', id: 1, method: subscribe, params });
      harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-sub' });
      const localToken = readAnswer(messages[0]).result;
      connection.send({ jsonrpc: '2.0', id: 2, method: release, params: [localToken] });
      const releaseId = readUpstreamRequest(harness.sent.at(-1)).id;

      // When the node still delivers an event it queued before it read the release
      const warnings = collectWarningsDuring(() => {
        harness.emit({
          jsonrpc: '2.0',
          method: event,
          params: { subscription: 'up-sub', result: { event: 'validated' } },
        });
      });
      harness.emit({ jsonrpc: '2.0', id: releaseId, result: releaseResult });

      // Then the event was dropped, and the session only got its two answers
      expect(warnings).toEqual([]);
      expect(messages).toEqual([
        { jsonrpc: '2.0', id: 1, result: localToken },
        { jsonrpc: '2.0', id: 2, result: releaseResult },
      ]);
    },
  );

  it('As a dApp that leaves while its unwatch is in flight, I leave no warning for an event the node sent before it read the unwatch', () => {
    // Given a session that watched a transaction, unwatched it and left before the node answered the unwatch
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x01'] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-tx' });
    const localToken = readAnswer(messages[0]).result;
    connection.send({ jsonrpc: '2.0', id: 2, method: 'transactionWatch_v1_unwatch', params: [localToken] });
    const unwatchId = readUpstreamRequest(harness.sent.at(-1)).id;
    connection.disconnect();

    // When the node still delivers an event it queued before it read the unwatch
    const warnings = collectWarningsDuring(() => {
      harness.emit({
        jsonrpc: '2.0',
        method: 'transactionWatch_v1_watchEvent',
        params: { subscription: 'up-tx', result: { event: 'validated' } },
      });
      harness.emit({ jsonrpc: '2.0', id: unwatchId, result: null });
    });

    // Then
    expect(warnings).toEqual([]);
    expect(harness.sent.map(message => message.method)).toEqual([
      'transactionWatch_v1_submitAndWatch',
      'transactionWatch_v1_unwatch',
    ]);
  });

  it('As a session that unwatches without an id, I leave no warning for an event the node sent before it read the unwatch', () => {
    // Given a session that watched a transaction and unwatched it without an id
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transactionWatch_v1_submitAndWatch', params: ['0x01'] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-tx' });
    connection.send({ jsonrpc: '2.0', method: 'transactionWatch_v1_unwatch', params: [readAnswer(messages[0]).result] });

    // When the node still delivers an event it queued before it read the unwatch
    const warnings = collectWarningsDuring(() => {
      harness.emit({
        jsonrpc: '2.0',
        method: 'transactionWatch_v1_watchEvent',
        params: { subscription: 'up-tx', result: { event: 'validated' } },
      });
    });

    // Then
    expect(warnings).toEqual([]);
  });

  it('As a maintainer, I see no warning when many watches a session unwatched still deliver events while a follow waits on its answer', () => {
    // Given a follow in flight, and a session that unwatches more watches than the early buffer keeps tokens for
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    broker
      .connect({ sessionId: 'a', onMessage: () => undefined })
      .send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'b', onMessage: message => messages.push(message) });
    const tokens = Array.from({ length: 33 }, (_, index) => `up-tx-${String(index)}`);
    for (const [index, token] of tokens.entries()) {
      connection.send({ jsonrpc: '2.0', id: index, method: 'transactionWatch_v1_submitAndWatch', params: ['0x01'] });
      harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: token });
    }
    for (const [index, message] of [...messages].entries()) {
      const localToken = readAnswer(message).result;
      connection.send({ jsonrpc: '2.0', id: 100 + index, method: 'transactionWatch_v1_unwatch', params: [localToken] });
    }

    // When the node still delivers an event for each watch before it reads the unwatches
    const warnings = collectWarningsDuring(() => {
      for (const token of tokens) {
        harness.emit({
          jsonrpc: '2.0',
          method: 'transactionWatch_v1_watchEvent',
          params: { subscription: token, result: { event: 'validated' } },
        });
      }
    });

    // Then none of the late events was buffered or warned about
    expect(warnings).toEqual([]);
  });
});

describe('createChainBroker upstream follow stop', () => {
  // Connects a session that re-follows from inside the delivery of a `stop`, as papi's chainHead client does. It gives up
  // after 20 stops, so a broker that keeps answering the re-follow with another stop ends instead of hanging.
  function connectRefollowingSession(broker: ChainBroker): { messages: JsonRpcMessage[]; countStops: () => number } {
    const messages: JsonRpcMessage[] = [];
    let stops = 0;
    let nextId = 2;
    const connection = broker.connect({
      sessionId: 'a',
      onMessage: message => {
        messages.push(message);
        if (readSubscriptionEvent(message)?.event === 'stop' && stops < 20) {
          stops += 1;
          connection.send({ jsonrpc: '2.0', id: nextId, method: 'chainHead_v1_follow', params: [true] });
          nextId += 1;
        }
      },
    });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    return { messages, countStops: () => stops };
  }

  it('As a dApp user, I re-follow when the node stops my follow and it is followed afresh once, not looped on the dead one', () => {
    // Given a session following through the broker, with its follow initialized
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const session = connectRefollowingSession(broker);
    const first = readUpstreamRequest(harness.sent[0]);
    harness.emit({ jsonrpc: '2.0', id: first.id, result: 'up-1' });
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-1', result: { event: 'initialized', finalizedBlockHashes: ['0xaa'] } },
    });

    // When the node stops the follow, and the session re-follows at once
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-1', result: { event: 'stop' } },
    });

    // Then one stop, and the re-follow goes upstream as a fresh follow
    expect(session.countStops()).toBe(1);
    const follows = harness.sent.filter(message => message.method === 'chainHead_v1_follow');
    expect(follows).toHaveLength(2);
  });

  it('As a dApp user, I carry on under the fresh follow and its own token, and the stopped one hears nothing more', () => {
    // Given
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const session = connectRefollowingSession(broker);
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const oldToken = readAnswer(session.messages[0]).result;
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-1', result: { event: 'stop' } },
    });
    const refollow = readUpstreamRequest(harness.sent.filter(message => message.method === 'chainHead_v1_follow')[1]);

    // When
    harness.emit({ jsonrpc: '2.0', id: refollow.id, result: 'up-2' });
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-2', result: { event: 'bestBlockChanged', bestBlockHash: '0xbb' } },
    });

    // Then
    const ack = readAnswer(session.messages.find(message => message.id === 2));
    expect(ack.result).not.toBe(oldToken);
    const best = session.messages
      .map(message => readSubscriptionEvent(message))
      .filter(event => event?.event === 'bestBlockChanged');
    expect(best.map(event => event?.subscription)).toEqual([ack.result]);
  });

  it('forwards the proxy stop and forgets the token', () => {
    // Given a session whose follow the node answered
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, result: 'up-1' });
    const localToken = readAnswer(messages[0]).result;
    const followsBefore = broker.countFollows();

    // When the proxy under the lane stops the follow on a reconnect
    harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_follow',
      params: { subscription: 'up-1', result: { event: 'stop', internal: true } },
    });

    // Then the session hears the stop on its local token, and the follow no longer counts
    expect(messages[1]).toEqual({
      jsonrpc: '2.0',
      method: 'chainHead_v1_follow',
      params: { subscription: localToken, result: { event: 'stop', internal: true } },
    });
    expect(broker.countFollows()).toBe(followsBefore - 1);

    // When the session unfollows that token
    const sentBefore = harness.sent.length;
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unfollow', params: [localToken] });

    // Then it is answered locally, and nothing went upstream
    expect(messages.at(-1)).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32603, message: 'Unknown subscription/token' },
    });
    expect(harness.sent).toHaveLength(sentBefore);
  });
});

describe('createChainBroker upstream answers', () => {
  it('As a session that re-follows as soon as my follow is refused, I get one fresh upstream follow', () => {
    // Given a session that follows again from inside the refusal, as papi does
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    let retries = 0;
    const connection = broker.connect({
      sessionId: 'a',
      onMessage: message => {
        if ('error' in message && retries < 5) {
          retries += 1;
          connection.send({ jsonrpc: '2.0', id: 10 + retries, method: 'chainHead_v1_follow', params: [true] });
        }
      },
    });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });

    // When the node refuses the follow
    harness.emit({
      jsonrpc: '2.0',
      id: readUpstreamRequest(harness.sent[0]).id,
      error: { code: -32800, message: 'Too many follows' },
    });

    // Then the session retried once and the node received two follows
    expect(retries).toBe(1);
    expect(harness.sent.filter(message => message.method === 'chainHead_v1_follow')).toHaveLength(2);
  });

  it('routes a broadcast answer that arrives from inside the upstream send, and maps its token', () => {
    // Given an upstream that answers a broadcast before its send returns, as the proxy under each lane does
    const sent: JsonRpcRequest[] = [];
    const broker = createChainBroker({
      provider: listener => ({
        send(message) {
          sent.push(message);
          if (message.method === 'transaction_v1_broadcast') {
            listener({ jsonrpc: '2.0', id: message.id ?? null, result: 'syn-1' });
          }
        },
        disconnect: () => undefined,
      }),
    });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });

    // When the session broadcasts, then stops the broadcast under the token it heard
    connection.send({ jsonrpc: '2.0', id: 1, method: 'transaction_v1_broadcast', params: ['0x0102'] });
    const answer = readAnswer(messages[0]);
    const heldBeforeStop = broker.hasToken(answer.result);
    connection.send({ jsonrpc: '2.0', id: 2, method: 'transaction_v1_stop', params: [answer.result] });

    // Then the session heard a local token under its id, and the stop went upstream under the proxy's token
    expect(answer.id).toBe(1);
    expect(heldBeforeStop).toBe(true);
    expect(sent.map(message => [message.method, message.params])).toEqual([
      ['transaction_v1_broadcast', ['0x0102']],
      ['transaction_v1_stop', ['syn-1']],
    ]);
  });

  it('passes a follow refusal whose error is not an object to its session', () => {
    // Given a session waiting on its follow
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const follow = readUpstreamRequest(harness.sent[0]);

    // When the node answers it with a null error
    expect(() => {
      harness.emit(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a null error is the malformed upstream answer under test, which the message type does not allow
        { jsonrpc: '2.0', id: follow.id, error: null } as unknown as JsonRpcMessage,
      );
    }).not.toThrow();

    // Then the session still hears the answer under its own id, and the follow no longer counts
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, error: null }]);
    expect(broker.countFollows()).toBe(0);
  });
});

describe('createChainBroker local tokens', () => {
  it('As a session that reconnects after the broker closed every session, I get a local token that continues the count instead of repeating an old one', () => {
    // Given a session that got its follow token before every session was closed
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const first = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    first.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-1' });
    broker.disconnectAll();

    // When the same session connects again and follows
    const second = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    second.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-2' });

    // Then
    expect(messages).toEqual([
      { jsonrpc: '2.0', id: 1, result: 'token:0:a' },
      { jsonrpc: '2.0', id: 2, result: 'token:1:a' },
    ]);
  });
});

describe('createChainBroker follow count', () => {
  // Builds a broker with one session `'a'` that records what it hears.
  function setUpSession() {
    const harness = createProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const messages: JsonRpcMessage[] = [];
    const connection = broker.connect({ sessionId: 'a', onMessage: message => messages.push(message) });
    return { harness, broker, messages, connection };
  }

  // Has session `'a'` follow, the node answer with `upstreamToken`, and returns the local token the session got.
  function follow({ harness, messages, connection }: ReturnType<typeof setUpSession>, upstreamToken: string): string {
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: upstreamToken });
    return readAnswer(messages.at(-1)).result;
  }

  it('As a lane, I count a follow from the moment a session sends it', () => {
    // Given a session on a broker
    const { broker, connection } = setUpSession();

    // When the session follows and the node has not answered yet
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });

    // Then the follow counts while it waits on its answer
    expect(broker.countFollows()).toBe(1);
  });

  it('As a lane, I count an answered follow as one', () => {
    // Given a session on a broker
    const setup = setUpSession();

    // When the session follows and the node answers
    follow(setup, 'up-1');

    // Then the answered follow counts as one
    expect(setup.broker.countFollows()).toBe(1);
  });

  it('As a lane, I keep counting a follow until the node answers its unfollow', () => {
    // Given a session whose follow the node answered
    const setup = setUpSession();
    const { broker, harness, connection } = setup;
    const token = follow(setup, 'up-1');

    // When the session unfollows, and later the node answers the unfollow
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unfollow', params: [token] });
    const whileUnfollowing = broker.countFollows();
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: null });

    // Then the follow counts while its unfollow is in flight, and not after its answer
    expect(whileUnfollowing).toBe(1);
    expect(broker.countFollows()).toBe(0);
  });

  it('As a lane, I stop counting a follow the node stops or refuses', () => {
    // Given one session whose follow the node answered, and another whose follow is in flight
    const stopped = setUpSession();
    follow(stopped, 'up-1');
    const refused = setUpSession();
    refused.connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });

    // When the node stops the first and refuses the second
    stopped.harness.emit({
      jsonrpc: '2.0',
      method: 'chainHead_v1_followEvent',
      params: { subscription: 'up-1', result: { event: 'stop' } },
    });
    refused.harness.emit({
      jsonrpc: '2.0',
      id: readUpstreamRequest(refused.harness.sent[0]).id,
      error: { code: -32000, message: 'Refused' },
    });

    // Then neither follow counts any more
    expect(stopped.broker.countFollows()).toBe(0);
    expect(refused.broker.countFollows()).toBe(0);
  });

  it('passes a refused follow to its session and stops counting it', () => {
    // Given a session whose follow is in flight
    const { broker, harness, messages, connection } = setUpSession();
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const refusal = { code: -32800, message: 'too many active follow subscriptions' };

    // When the node refuses it for its follow limit
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent[0]).id, error: refusal });

    // Then the session gets the refusal, and the follow no longer counts
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, error: refusal }]);
    expect(broker.countFollows()).toBe(0);
  });

  it('As a lane, I count the unfollow of a follow whose session left before its answer until the node answers it', () => {
    // Given a session whose follow is in flight
    const { broker, harness, connection } = setUpSession();
    connection.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    const followRequest = readUpstreamRequest(harness.sent[0]);

    // When the session leaves, the node answers the follow, and later the broker's own unfollow
    connection.disconnect();
    harness.emit({ jsonrpc: '2.0', id: followRequest.id, result: 'up-1' });
    const unfollow = readUpstreamRequest(harness.sent.at(-1));
    const whileUnfollowing = broker.countFollows();
    harness.emit({ jsonrpc: '2.0', id: unfollow.id, result: null });

    // Then the broker's unfollow counts until its answer
    expect([unfollow.method, unfollow.params]).toEqual(['chainHead_v1_unfollow', ['up-1']]);
    expect(whileUnfollowing).toBe(1);
    expect(broker.countFollows()).toBe(0);
  });

  it('As a lane, I count an unfollow a session sends without an id until the node answers it', () => {
    // Given a session whose follow the node answered
    const setup = setUpSession();
    const { broker, harness, messages, connection } = setup;
    const token = follow(setup, 'up-1');

    // When the session unfollows without an id, and later the node answers
    connection.send({ jsonrpc: '2.0', method: 'chainHead_v1_unfollow', params: [token] });
    const unfollow = readUpstreamRequest(harness.sent.at(-1));
    const whileUnfollowing = broker.countFollows();
    harness.emit({ jsonrpc: '2.0', id: unfollow.id, result: null });

    // Then the unfollow went upstream under a broker id, counted until its answer, and the session heard nothing
    expect([unfollow.method, unfollow.params]).toEqual(['chainHead_v1_unfollow', ['up-1']]);
    expect(whileUnfollowing).toBe(1);
    expect(broker.countFollows()).toBe(0);
    expect(messages).toEqual([{ jsonrpc: '2.0', id: 1, result: token }]);
  });

  it('As a lane, I count a follow a session sends without an id, and unfollow its answer', () => {
    // Given a session on a broker
    const { broker, harness, messages, connection } = setUpSession();

    // When the session follows without an id, the node answers, and later answers the broker's unfollow
    connection.send({ jsonrpc: '2.0', method: 'chainHead_v1_follow', params: [true] });
    const followRequest = readUpstreamRequest(harness.sent[0]);
    const whileFollowing = broker.countFollows();
    harness.emit({ jsonrpc: '2.0', id: followRequest.id, result: 'up-1' });
    const unfollow = readUpstreamRequest(harness.sent.at(-1));
    const whileUnfollowing = broker.countFollows();
    harness.emit({ jsonrpc: '2.0', id: unfollow.id, result: null });

    // Then the follow went under a broker id, its token was unfollowed at once, and it counted until that answer
    expect(followRequest.method).toBe('chainHead_v1_follow');
    expect([unfollow.method, unfollow.params]).toEqual(['chainHead_v1_unfollow', ['up-1']]);
    expect(whileFollowing).toBe(1);
    expect(whileUnfollowing).toBe(1);
    expect(broker.countFollows()).toBe(0);
    expect(messages).toEqual([]);
  });

  it('As a lane router, I learn that a broker holds only the tokens its sessions got', () => {
    // Given a session whose follow the node answered
    const setup = setUpSession();
    const { broker } = setup;
    const token = follow(setup, 'up-1');

    // When the router asks the broker about its own token, another broker's token and the upstream token
    const held = [broker.hasToken(token), broker.hasToken('token:9:other'), broker.hasToken('up-1')];

    // Then the broker knows only its own token
    expect(held).toEqual([true, false, false]);
  });

  it('As a lane router, I learn that a broker forgets a token at the unfollow', () => {
    // Given a session whose follow the node answered
    const setup = setUpSession();
    const { broker, harness, connection } = setup;
    const token = follow(setup, 'up-1');

    // When the session unfollows and the router asks about the token
    connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_unfollow', params: [token] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: null });
    const held = broker.hasToken(token);

    // Then the broker no longer holds it
    expect(held).toBe(false);
  });
});

describe('createChainBroker teardown', () => {
  // An upstream provider that counts its openings, and whose sends and close throw while their flag is set.
  function createFailingProviderHarness() {
    const sent: JsonRpcRequest[] = [];
    let onMessage: ((message: JsonRpcMessage) => void) | null = null;
    const flags = { failSends: false, failClose: false };
    let opened = 0;
    const disconnect = vi.fn(() => {
      if (flags.failClose) {
        throw new Error('close failed');
      }
    });

    const provider: JsonRpcProvider = (listener): JsonRpcConnection => {
      opened += 1;
      onMessage = listener;
      return {
        send(message) {
          sent.push(message);
          if (flags.failSends) {
            throw new Error('send failed');
          }
        },
        disconnect,
      };
    };

    return {
      provider,
      sent,
      disconnect,
      flags,
      getOpened: () => opened,
      emit(message: JsonRpcMessage) {
        onMessage?.(message);
      },
    };
  }

  // Connects session `'a'`, which follows and gets upstream token `'up-1'`, then session `'b'`, which only connects.
  function connectFollowerAndIdle(harness: ReturnType<typeof createFailingProviderHarness>, broker: ChainBroker) {
    const follower = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    follower.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    harness.emit({ jsonrpc: '2.0', id: readUpstreamRequest(harness.sent.at(-1)).id, result: 'up-1' });
    // Idle, so `'a'`'s release is the only send that fails.
    broker.connect({ sessionId: 'b', onMessage: () => undefined });
  }

  it("As an integrator, I disconnect all while a session's release fails upstream and every other session ends and the upstream still closes", () => {
    // Given a following session and an idle one, and an upstream whose sends throw
    const harness = createFailingProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    connectFollowerAndIdle(harness, broker);
    harness.flags.failSends = true;

    // When every session is closed, the release's failure is thrown as is
    expect(() => {
      broker.disconnectAll();
    }).toThrow(new Error('send failed'));

    // Then the upstream closed once, and the idle session's id is free
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
    expect(() => broker.connect({ sessionId: 'b', onMessage: () => undefined })).not.toThrow();
  });

  it('As an integrator, I disconnect all while the upstream fails to close and a later session opens a fresh upstream', () => {
    // Given a session that sent a request, and an upstream whose close throws
    const harness = createFailingProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    const first = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    first.send({ jsonrpc: '2.0', id: 1, method: 'system_chain', params: [] });
    harness.flags.failClose = true;

    // When every session is closed, the close's failure is thrown as is
    expect(() => {
      broker.disconnectAll();
    }).toThrow(new Error('close failed'));

    // When a later session sends a request
    const second = broker.connect({ sessionId: 'b', onMessage: () => undefined });
    second.send({ jsonrpc: '2.0', id: 2, method: 'system_chain', params: [] });

    // Then the later session opened a second upstream
    expect(harness.getOpened()).toBe(2);
  });

  it("As an integrator, I disconnect all while a session's release and the upstream's close both fail and I get both errors", () => {
    // Given a following session and an idle one, and an upstream whose sends and close throw
    const harness = createFailingProviderHarness();
    const broker = createChainBroker({ provider: harness.provider });
    connectFollowerAndIdle(harness, broker);
    harness.flags.failSends = true;
    harness.flags.failClose = true;

    // When every session is closed, both failures are thrown together, in the order they happened
    expect(() => {
      broker.disconnectAll();
    }).toThrow(
      expect.objectContaining({
        name: 'AggregateError',
        errors: [new Error('send failed'), new Error('close failed')],
      }),
    );

    // Then the upstream closed once
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
  });

  it('As an integrator, I reopen a broker after closing every session and a late message from the closed upstream reaches no one', () => {
    // Given a first upstream with a session's request, closed, and a second upstream with another session's request
    const listeners: ((message: JsonRpcMessage) => void)[] = [];
    const sent: JsonRpcRequest[] = [];
    const broker = createChainBroker({
      provider: listener => {
        listeners.push(listener);
        return {
          send(message) {
            sent.push(message);
          },
          disconnect: () => undefined,
        };
      },
    });
    const first = broker.connect({ sessionId: 'a', onMessage: () => undefined });
    first.send({ jsonrpc: '2.0', id: 1, method: 'system_chain', params: [] });
    broker.disconnectAll();
    const heard: JsonRpcMessage[] = [];
    const second = broker.connect({
      sessionId: 'b',
      onMessage: message => {
        heard.push(message);
      },
    });
    second.send({ jsonrpc: '2.0', id: 2, method: 'system_chain', params: [] });
    const secondId = readUpstreamRequest(sent.at(-1)).id;
    const firstListener = listeners[0];
    expect(firstListener).toBeDefined();
    if (firstListener === undefined) {
      return;
    }

    // When the first upstream answers under the second request's broker id
    firstListener({ jsonrpc: '2.0', id: secondId, result: 'stale' });

    // Then the second session hears nothing
    expect(heard).toEqual([]);
  });

  it('As an integrator, I close every session while the upstream opens, and the next session opens a fresh one', () => {
    // Given an upstream whose first opening closes every session before its provider call returns
    const harness = createProviderHarness();
    let opened = 0;
    const broker: ChainBroker = createChainBroker({
      provider: listener => {
        opened += 1;
        const connection = harness.provider(listener);
        if (opened === 1) {
          broker.disconnectAll();
        }
        return connection;
      },
    });

    // When a first session connects and sends a follow, then a second session does the same
    collectWarningsDuring(() => {
      const first = broker.connect({ sessionId: 'a', onMessage: () => undefined });
      first.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
    });
    const second = broker.connect({ sessionId: 'b', onMessage: () => undefined });
    second.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_follow', params: [true] });

    // Then the first opening was closed, and only the second session's follow went upstream
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.sent.map(request => request.method)).toEqual(['chainHead_v1_follow']);
  });

  it('As an integrator, I close every session while the upstream opens and its close throws, and I get a warning, not a throw', () => {
    // Given an upstream that closes every session as it opens, and whose close throws
    const harness = createProviderHarness();
    harness.disconnect.mockImplementation(() => {
      throw new Error('close refused');
    });
    const broker: ChainBroker = createChainBroker({
      provider: listener => {
        const connection = harness.provider(listener);
        broker.disconnectAll();
        return connection;
      },
    });

    // When a session connects
    const warnings = collectWarningsDuring(() => {
      expect(() => broker.connect({ sessionId: 'a', onMessage: () => undefined })).not.toThrow();
    });

    // Then the failed close is warned under the broker's tag
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
    expect(warnings).toEqual([
      expect.stringContaining('[chain-broker] closing an upstream closed while it opened failed: close refused'),
    ]);
  });

  it('As an integrator, I connect while the upstream throws as it opens, and my next session opens it again', () => {
    // Given an upstream whose first opening throws
    const harness = createProviderHarness();
    let opened = 0;
    const broker = createChainBroker({
      provider: listener => {
        opened += 1;
        if (opened === 1) {
          throw new Error('refused');
        }
        return harness.provider(listener);
      },
    });

    // When a first session connects, its connect throws the provider's error
    expect(() => broker.connect({ sessionId: 'a', onMessage: () => undefined })).toThrow('refused');

    // When a second session connects and sends a follow
    const second = broker.connect({ sessionId: 'b', onMessage: () => undefined });
    second.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_follow', params: [true] });

    // Then the second session's follow went upstream
    expect(harness.sent.map(request => request.method)).toEqual(['chainHead_v1_follow']);
  });

  it('As an integrator, I connect from inside the provider call that opens the upstream and my inner session is never served', () => {
    // Given an upstream whose first opening connects an inner session that sends a follow
    const harness = createProviderHarness();
    let opened = 0;
    const broker: ChainBroker = createChainBroker({
      provider: listener => {
        opened += 1;
        if (opened === 1) {
          const inner = broker.connect({ sessionId: 'inner', onMessage: () => undefined });
          inner.send({ jsonrpc: '2.0', id: 1, method: 'chainHead_v1_follow', params: [true] });
        }
        return harness.provider(listener);
      },
    });

    // When an outer session connects
    collectWarningsDuring(() => {
      broker.connect({ sessionId: 'outer', onMessage: () => undefined });
    });

    // Then the upstream opened once, and the inner session's follow never went upstream
    expect(opened).toBe(1);
    expect(harness.sent).toEqual([]);
  });
});
