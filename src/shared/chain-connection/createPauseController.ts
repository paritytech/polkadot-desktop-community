import { type JsonRpcConnection, type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { type InnerJsonRpcProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type Middleware } from '@polkadot-api/ws-provider';

type PauseController = {
  middleware: Middleware;
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
};

// Plugs into getWsProvider's `middleware` option. Pause closes the live socket
// and stalls auto-reconnect; resume opens a fresh socket and flushes buffered
// sends.
export function createPauseController(): PauseController {
  let paused = false;
  let destroyed = false;
  let base: InnerJsonRpcProvider | null = null;
  let onMessage: ((msg: JsonRpcMessage) => void) | null = null;
  let onHalt: ((e?: unknown) => void) | null = null;
  let real: JsonRpcConnection | null = null;
  let buffer: JsonRpcRequest[] = [];
  // a halt we fired already scheduled a middleware re-invocation — resume
  // must defer to it rather than reusing the stale onMessage/onHalt pair
  let reinvocationPending = false;

  const connect = () => {
    if (!base || !onMessage || !onHalt) return;
    real = base(onMessage, onHalt);
    const q = buffer;
    buffer = [];
    for (const m of q) real.send(m);
  };

  const middleware: Middleware = b => {
    base = b;
    return (onMsg, onH) => {
      reinvocationPending = false;
      // A new inner invocation means a fresh consumer (e.g. the host cached
      // this provider across destroy → re-acquire). Clear `destroyed` so
      // pause/resume work on the new connection. The flag's job is to gate
      // pause/resume between the previous inner.disconnect and the next
      // inner re-invocation — outside that window it should not stick.
      destroyed = false;
      onMessage = onMsg;
      onHalt = onH;
      real = null;
      if (!paused) connect();
      return {
        send: m => (real ? real.send(m) : buffer.push(m)),
        disconnect: () => {
          destroyed = true;
          paused = false;
          buffer = [];
          real?.disconnect();
          real = null;
        },
      };
    };
  };

  const pause = () => {
    if (paused || destroyed) return;
    paused = true;
    if (!real || !onHalt) return;
    reinvocationPending = true;
    const r = real;
    real = null;
    // withSocket.disconnect detaches listeners before close — no halt fires
    // from there, so trigger it manually to drive getProxy's replay.
    r.disconnect();
    onHalt({ type: 'paused' });
  };

  const resume = () => {
    if (destroyed || !paused) return;
    paused = false;
    if (!reinvocationPending) connect();
  };

  return { middleware, pause, resume, isPaused: () => paused };
}
