import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type InnerJsonRpcProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { describe, expect, it, vi } from 'vitest';

import { createPauseController } from './createPauseController';

// Integration: pauseController + getSyncProvider's proxy. Mirrors the
// chainConnectionManager "fresh follow after a stop" test, but the Stop comes
// from the synthetic-Stop machinery that fires when pause halts the inner
// provider — i.e. the exact flow the host hits on a real pause/resume.

type BaseInvocation = {
  onMessage: (msg: JsonRpcMessage) => void;
  onHalt: (e?: unknown) => void;
  send: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

async function flushMicroAndTimers() {
  await vi.advanceTimersByTimeAsync(0);
}

function req(id: number | string, method: string, params: unknown[] = []): JsonRpcRequest {
  return {
    jsonrpc: '2.0' as const,
    id,
    method,
    params,
  };
}

function isFollowStop(message: JsonRpcMessage, subscription: string): boolean {
  return (
    'method' in message &&
    message.method === 'chainHead_v1_follow' &&
    message.params?.subscription === subscription &&
    message.params?.result?.event === 'stop'
  );
}

function followNotif(subscription: string, result: unknown): JsonRpcMessage {
  return {
    jsonrpc: '2.0',
    method: 'chainHead_v1_followEvent',
    params: { subscription, result },
  };
}

describe('pauseController × getSyncProvider integration', () => {
  it('routes follow events to the new listener after pause+resume+refollow (best blocks must keep flowing)', async () => {
    vi.useFakeTimers();
    try {
      const invocations: BaseInvocation[] = [];

      const base: InnerJsonRpcProvider = (onMessage, onHalt) => {
        const send = vi.fn();
        const disconnect = vi.fn();
        invocations.push({
          onMessage,
          onHalt,
          send,
          disconnect,
        });
        return { send, disconnect };
      };

      const pc = createPauseController();
      const inner = pc.middleware(base);

      // Wrap the pausable inner in getSyncProvider so we get the same proxy /
      // synthetic-Stop machinery the WS provider gets via getWsProvider.
      const provider = getSyncProvider(onReady => {
        onReady((onMsg, onHalt) => inner(onMsg, onHalt));
        return () => {
          /* no teardown for the scheduling step */
        };
      });

      const events: JsonRpcMessage[] = [];
      const conn = provider(msg => events.push(msg));

      // getSyncProvider schedules input via setTimeout(0); flush it so the
      // base receives onMessage/onHalt and the proxy reaches Connected.
      await flushMicroAndTimers();
      expect(invocations).toHaveLength(1);

      // Initial follow: consumer sends chainHead_v1_follow, the base "chain"
      // assigns sub-id-1, and a bestBlockChanged event arrives.
      conn.send(req(1, 'chainHead_v1_follow', [true]));
      expect(invocations[0]!.send).toHaveBeenCalledWith(req(1, 'chainHead_v1_follow', [true]));

      invocations[0]!.onMessage({ jsonrpc: '2.0', id: 1, result: 'sub-id-1' });
      invocations[0]!.onMessage(followNotif('sub-id-1', { event: 'bestBlockChanged', bestBlockHash: '0xaa' }));

      expect(events).toContainEqual({ jsonrpc: '2.0', id: 1, result: 'sub-id-1' });
      expect(events).toContainEqual(followNotif('sub-id-1', { event: 'bestBlockChanged', bestBlockHash: '0xaa' }));

      // === pause ===
      // pauseController.pause() disconnects the live socket and manually fires
      // onHalt({type:'paused'}). The proxy reacts by synthesizing a stop
      // notification for every active chainHead — which is what surfaces to
      // the consumer as "the follow died, please refollow".
      events.length = 0;
      pc.pause();

      const syntheticStop = events.find(m => isFollowStop(m, 'sub-id-1'));
      expect(syntheticStop).toBeDefined();
      expect(invocations[0]!.disconnect).toHaveBeenCalledTimes(1);

      // Consumer's substrate-client refollows synchronously inside the stop
      // handler. The new chainHead_v1_follow goes into the proxy's pending
      // queue while the base is paused.
      conn.send(req(2, 'chainHead_v1_follow', [true]));
      expect(invocations[0]!.send).not.toHaveBeenCalledWith(req(2, 'chainHead_v1_follow', [true]));

      // === resume ===
      pc.resume();
      // After resume, the base is re-invoked (new "connection") and the
      // queued send is flushed. proxy.start() has its own setTimeout backoff;
      // flush all timers so the new connection is established.
      await vi.advanceTimersByTimeAsync(10_000);

      expect(invocations.length).toBeGreaterThanOrEqual(2);
      const fresh = invocations[invocations.length - 1]!;

      // The buffered chainHead_v1_follow must hit the fresh base.
      expect(fresh.send).toHaveBeenCalledWith(req(2, 'chainHead_v1_follow', [true]));

      // Server assigns a NEW subId on the new connection.
      fresh.onMessage({ jsonrpc: '2.0', id: 2, result: 'sub-id-2' });

      // bestBlockChanged on sub-id-2 must reach the consumer — this is the
      // assertion that fails if pause/resume drops best-block flow.
      events.length = 0;
      fresh.onMessage(followNotif('sub-id-2', { event: 'bestBlockChanged', bestBlockHash: '0xcc' }));

      expect(events).toContainEqual(followNotif('sub-id-2', { event: 'bestBlockChanged', bestBlockHash: '0xcc' }));
      // And no stale sub-id-1 events should have leaked through after refollow.
      expect(events.some(m => 'method' in m && m.method === 'chainHead_v1_follow' && m.params?.subscription === 'sub-id-1')).toBe(
        false,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
