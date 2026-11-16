import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type InnerJsonRpcProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { describe, expect, it, vi } from 'vitest';

import { createPauseController } from './createPauseController';

type HandleMessage = (msg: JsonRpcMessage) => void;
type HandleHalt = (e?: unknown) => void;

function createMockBase() {
  const invocations: {
    onMessage: HandleMessage;
    onHalt: HandleHalt;
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];

  const base: InnerJsonRpcProvider = (onMessage, onHalt) => {
    const send = vi.fn();
    const disconnect = vi.fn();
    invocations.push({ onMessage, onHalt, send, disconnect });
    return { send, disconnect };
  };

  return {
    base,
    invocations,
    get latest() {
      const last = invocations[invocations.length - 1];
      if (!last) throw new Error('no base connection has been created yet');
      return last;
    },
  };
}

function req(id: number | string, method: string, params: unknown[] = []): JsonRpcRequest {
  return {
    jsonrpc: '2.0' as const,
    id,
    method,
    params,
  };
}

describe('createPauseController', () => {
  it('connects on first inner invocation and forwards sends', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);

    expect(mock.invocations).toHaveLength(0);

    const conn = inner(vi.fn(), vi.fn());

    expect(mock.invocations).toHaveLength(1);
    expect(pc.isPaused()).toBe(false);

    conn.send(req(1, 'foo'));
    expect(mock.latest.send).toHaveBeenCalledWith(req(1, 'foo'));
  });

  it('forwards inbound messages from the base to the stored onMessage', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const onMessage = vi.fn();
    pc.middleware(mock.base)(onMessage, vi.fn());

    const message: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'x' };
    mock.latest.onMessage(message);

    expect(onMessage).toHaveBeenCalledWith(message);
  });

  it('forwards halts from the base to the stored onHalt', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const onHalt = vi.fn();
    pc.middleware(mock.base)(vi.fn(), onHalt);

    const haltReason = { type: 'socket-closed' };
    mock.latest.onHalt(haltReason);

    expect(onHalt).toHaveBeenCalledWith(haltReason);
  });

  it('pause disconnects the live socket and fires a paused halt', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const onHalt = vi.fn();
    pc.middleware(mock.base)(vi.fn(), onHalt);

    pc.pause();

    expect(pc.isPaused()).toBe(true);
    expect(mock.latest.disconnect).toHaveBeenCalledTimes(1);
    expect(onHalt).toHaveBeenCalledWith({ type: 'paused' });
  });

  it('pause is a no-op when already paused', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const onHalt = vi.fn();
    pc.middleware(mock.base)(vi.fn(), onHalt);

    pc.pause();
    onHalt.mockClear();

    pc.pause();

    expect(mock.latest.disconnect).toHaveBeenCalledTimes(1);
    expect(onHalt).not.toHaveBeenCalled();
  });

  it('pause before the inner provider has been invoked does not fire a halt', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    pc.middleware(mock.base);

    pc.pause();

    expect(pc.isPaused()).toBe(true);
    expect(mock.invocations).toHaveLength(0);
  });

  it('buffers sends while paused and flushes them in order after the post-halt re-invocation + resume', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    const conn = inner(vi.fn(), vi.fn());

    pc.pause();
    conn.send(req(1, 'a'));
    conn.send(req(2, 'b'));

    // simulate the re-invocation that onHalt → getProxy would drive
    inner(vi.fn(), vi.fn());
    expect(mock.invocations).toHaveLength(1); // still paused — no new base connection yet

    pc.resume();

    expect(mock.invocations).toHaveLength(2);
    expect(mock.latest.send).toHaveBeenNthCalledWith(1, req(1, 'a'));
    expect(mock.latest.send).toHaveBeenNthCalledWith(2, req(2, 'b'));
    expect(pc.isPaused()).toBe(false);
  });

  it('re-invocation while paused does not open a new socket', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    inner(vi.fn(), vi.fn());

    pc.pause();
    inner(vi.fn(), vi.fn());
    inner(vi.fn(), vi.fn());

    expect(mock.invocations).toHaveLength(1);
  });

  it('resume without a pending re-invocation connects directly', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);

    // pause before any real connection exists — no halt fires, so no re-invocation is pending
    pc.pause();
    inner(vi.fn(), vi.fn());
    expect(mock.invocations).toHaveLength(0);

    pc.resume();

    expect(mock.invocations).toHaveLength(1);
    expect(pc.isPaused()).toBe(false);
  });

  it('resume is a no-op when not paused', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    inner(vi.fn(), vi.fn());

    pc.resume();

    expect(mock.invocations).toHaveLength(1);
    expect(pc.isPaused()).toBe(false);
  });

  it('after a re-invocation, inbound messages from the new base reach the new onMessage', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    const firstOnMessage = vi.fn();
    inner(firstOnMessage, vi.fn());

    pc.pause();
    const secondOnMessage = vi.fn();
    inner(secondOnMessage, vi.fn());
    pc.resume();

    const message: JsonRpcMessage = { jsonrpc: '2.0', id: 9, result: 'y' };
    mock.latest.onMessage(message);

    expect(secondOnMessage).toHaveBeenCalledWith(message);
    expect(firstOnMessage).not.toHaveBeenCalled();
  });

  it('disconnect tears down and makes subsequent pause/resume no-ops', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    const onHalt = vi.fn();
    const conn = inner(vi.fn(), onHalt);

    conn.disconnect();
    expect(mock.latest.disconnect).toHaveBeenCalledTimes(1);

    pc.pause();
    expect(pc.isPaused()).toBe(false);
    expect(onHalt).not.toHaveBeenCalled();

    pc.resume();
    expect(mock.invocations).toHaveLength(1);
  });

  it('disconnect drops buffered sends so a later reconnect does not flush stale messages', () => {
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);
    const conn = inner(vi.fn(), vi.fn());

    pc.pause();
    conn.send(req(1, 'lost'));
    conn.disconnect();

    // a new controller wouldn't share buffer, but even a fresh inner call on the same
    // controller (as might happen if getProxy retries) must not replay pre-disconnect buffer
    inner(vi.fn(), vi.fn());

    expect(mock.latest.send).not.toHaveBeenCalled();
  });

  it('pause/resume work again after disconnect + a fresh inner invocation', () => {
    // The host caches one provider per chain. After destroyClient cascades
    // through the inner connection's disconnect, the same pauseController is
    // reused on the next lockApi. pause/resume must drive the new socket; the
    // `destroyed` flag from the prior teardown must not stick.
    const mock = createMockBase();
    const pc = createPauseController();
    const inner = pc.middleware(mock.base);

    const firstConn = inner(vi.fn(), vi.fn());
    firstConn.disconnect(); // sets destroyed = true under the old design

    const secondOnHalt = vi.fn();
    inner(vi.fn(), secondOnHalt);
    expect(mock.invocations).toHaveLength(2); // new socket opened

    pc.pause();
    expect(pc.isPaused()).toBe(true);
    expect(mock.invocations[1]!.disconnect).toHaveBeenCalledTimes(1);
    expect(secondOnHalt).toHaveBeenCalledWith({ type: 'paused' });

    inner(vi.fn(), vi.fn()); // simulate the post-halt re-invocation
    expect(mock.invocations).toHaveLength(2); // still paused → no new base connection

    pc.resume();
    expect(pc.isPaused()).toBe(false);
    expect(mock.invocations).toHaveLength(3); // resume opens a fresh socket
  });
});
