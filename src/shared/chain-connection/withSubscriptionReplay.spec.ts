import { type JsonRpcMessage, type JsonRpcRequest, type JsonRpcResponse } from '@polkadot-api/json-rpc-provider';
import { type JsonRpcProvider } from 'polkadot-api';
import { describe, expect, it, vi } from 'vitest';

import { withSubscriptionReplay } from './withSubscriptionReplay';

function createMockProvider() {
  const send = vi.fn();
  const disconnect = vi.fn();
  let onMessage: ((msg: JsonRpcMessage) => void) | null = null;

  const provider: JsonRpcProvider = cb => {
    onMessage = cb;

    return { send, disconnect };
  };

  return { provider, send, disconnect, simulateMessage: (msg: JsonRpcMessage) => onMessage?.(msg) };
}

function createReconnectControl() {
  let callback: VoidFunction | null = null;
  const unsubscribe = vi.fn(() => {
    callback = null;
  });

  function onReconnect(cb: VoidFunction) {
    callback = cb;

    return unsubscribe;
  }

  return {
    onReconnect,
    triggerReconnect: () => callback?.(),
    unsubscribe,
  };
}

// Helper to create typed request objects
function req(id: number, method: string, params: unknown[] = []): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method, params };
}
function res(id: number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

describe('withSubscriptionReplay', () => {
  it('forwards all incoming messages to onMessage unmodified', () => {
    const mock = createMockProvider();
    const { onReconnect } = createReconnectControl();
    const onMessage = vi.fn();

    withSubscriptionReplay(mock.provider, onReconnect)(onMessage);
    mock.simulateMessage(res(1, '0xabc'));

    expect(onMessage).toHaveBeenCalledWith(res(1, '0xabc'));
  });

  it('forwards send calls to the underlying provider', () => {
    const mock = createMockProvider();
    const { onReconnect } = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, onReconnect)(vi.fn());

    conn.send(req(1, 'chain_getBlock'));

    expect(mock.send).toHaveBeenCalledWith(req(1, 'chain_getBlock'));
  });

  it('does not replay non-subscription requests on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    conn.send(req(1, 'chain_getBlock'));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).not.toHaveBeenCalled();
  });

  it('leaves unconfirmed subscribes to the transport underneath on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    const subscribeMsg = req(1, 'statement_subscribeStatement');
    conn.send(subscribeMsg);
    // intentionally no simulateMessage — subscription not confirmed by server
    mock.send.mockClear();

    control.triggerReconnect();

    // `getSyncProvider`'s proxy re-sends it on its own; a second copy from here
    // would leave an unmatched subscription live on the server.
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('still recognises the response to an unconfirmed subscribe the transport re-sent', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const onMessage = vi.fn();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(onMessage);

    const subscribeMsg = req(1, 'statement_subscribeStatement');
    conn.send(subscribeMsg);
    control.triggerReconnect();
    // The transport's own replay puts it back on the wire; the answer arrives
    // against the id we are still holding a pending entry for.
    mock.simulateMessage(res(1, 'sub-1'));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(onMessage).toHaveBeenCalledWith(res(1, 'sub-1'));
    expect(mock.send).toHaveBeenCalledWith(subscribeMsg);
  });

  it('replays active subscriptions on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());
    const subscribeMsg = req(1, 'statement_subscribeStatement');

    conn.send(subscribeMsg);
    mock.simulateMessage(res(1, 'sub-id-1'));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).toHaveBeenCalledWith(subscribeMsg);
  });

  it('replays multiple active subscriptions on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());
    const msg1 = req(1, 'statement_subscribeStatement');
    const msg2 = req(2, 'state_subscribeStorage', [[]]);

    conn.send(msg1);
    mock.simulateMessage(res(1, 'sub-id-1'));
    conn.send(msg2);
    mock.simulateMessage(res(2, 'sub-id-2'));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).toHaveBeenCalledTimes(2);
    expect(mock.send).toHaveBeenCalledWith(msg1);
    expect(mock.send).toHaveBeenCalledWith(msg2);
  });

  it('leaves a re-subscribe still in flight to the transport underneath on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    conn.send(req(1, 'statement_subscribeStatement'));
    mock.simulateMessage(res(1, 'sub-1'));
    control.triggerReconnect();
    // intentionally no answer to the re-subscribe — the proxy re-sends it itself
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).not.toHaveBeenCalled();
  });

  it('replays again a subscription whose re-subscribe was refused', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());
    const subscribeMsg = req(1, 'statement_subscribeStatement');

    conn.send(subscribeMsg);
    mock.simulateMessage(res(1, 'sub-1'));
    control.triggerReconnect();
    mock.simulateMessage({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error' } });
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).toHaveBeenCalledWith(subscribeMsg);
  });

  it('translates inbound notifications from the new server subId back to the consumer-facing subId after reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const onMessage = vi.fn();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(onMessage);

    conn.send(req(1, 'statement_subscribeStatement'));
    mock.simulateMessage(res(1, 'old-sub-id'));

    control.triggerReconnect();
    mock.simulateMessage(res(1, 'new-sub-id'));

    // The post-reconnect re-confirmation must NOT reach the consumer; it would be
    // a duplicate response for a request whose callback was consumed on first connect.
    expect(onMessage).not.toHaveBeenCalledWith(res(1, 'new-sub-id'));

    // Notifications from the server now arrive under the new server subId. The
    // middleware must rewrite them to the consumer's stable subId, otherwise
    // the consumer's subscription manager (which only ever saw 'old-sub-id')
    // would route them nowhere.
    onMessage.mockClear();
    mock.simulateMessage({
      jsonrpc: '2.0',
      method: 'state_storage',
      params: { subscription: 'new-sub-id', result: { changes: [] } },
    });
    expect(onMessage).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'state_storage',
      params: { subscription: 'old-sub-id', result: { changes: [] } },
    });
  });

  it('translates outbound unsubscribe requests from the consumer-facing subId to the current server subId', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    conn.send(req(1, 'statement_subscribeStatement'));
    mock.simulateMessage(res(1, 'old-sub-id'));

    control.triggerReconnect();
    mock.simulateMessage(res(1, 'new-sub-id'));

    mock.send.mockClear();
    // Consumer only knows 'old-sub-id' (the first response it ever received).
    // Middleware must rewrite the unsubscribe params to use the current server subId.
    conn.send(req(2, 'statement_unsubscribeStatement', ['old-sub-id']));

    expect(mock.send).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'statement_unsubscribeStatement', params: ['new-sub-id'] }),
    );
  });

  it('drops a subscription on consumer-side unsubscribe so it is not replayed on the next reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());
    const subscribeMsg = req(1, 'statement_subscribeStatement');

    conn.send(subscribeMsg);
    mock.simulateMessage(res(1, 'old-sub-id'));

    control.triggerReconnect();
    mock.simulateMessage(res(1, 'new-sub-id'));

    // Consumer unsubscribes using the only subId it knows about.
    conn.send(req(2, 'statement_unsubscribeStatement', ['old-sub-id']));
    mock.send.mockClear();

    control.triggerReconnect();

    // Subscription was unsubscribed; nothing should be re-sent.
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('does not replay unsubscribed subscriptions on reconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    conn.send(req(1, 'statement_subscribeStatement'));
    mock.simulateMessage(res(1, 'sub-id-1'));
    conn.send(req(2, 'statement_unsubscribeStatement', ['sub-id-1']));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).not.toHaveBeenCalled();
  });

  it('clears subscriptions and calls unsubscribe on disconnect', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());

    conn.send(req(1, 'statement_subscribeStatement'));
    mock.simulateMessage(res(1, 'sub-id-1'));

    conn.disconnect();

    expect(mock.disconnect).toHaveBeenCalledTimes(1);
    expect(control.unsubscribe).toHaveBeenCalledTimes(1);

    // reconnect after disconnect should not replay (maps were cleared)
    mock.send.mockClear();
    control.triggerReconnect();
    expect(mock.send).not.toHaveBeenCalled();
  });

  it('should ignore chain subscriptions', () => {
    const mock = createMockProvider();
    const control = createReconnectControl();
    const conn = withSubscriptionReplay(mock.provider, control.onReconnect)(vi.fn());
    const subscribeMsg = req(1, 'chain_subscribeNewHeads');

    conn.send(subscribeMsg);
    mock.simulateMessage(res(1, 'sub-id-1'));
    mock.send.mockClear();

    control.triggerReconnect();

    expect(mock.send).not.toHaveBeenCalledWith(subscribeMsg);
  });
});
