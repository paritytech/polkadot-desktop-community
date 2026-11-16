import { type JsonRpcConnection } from '@polkadot-api/json-rpc-provider';
import { getSyncProvider } from '@polkadot-api/json-rpc-provider-proxy';
import { type JsonRpcProvider } from 'polkadot-api';

import { isPausable } from './createWsJsonRpcProvider';
import { noop } from './noop';
import { withSubscriptionReplay } from './withSubscriptionReplay';

export type RestartableJsonRpcProvider = JsonRpcProvider & {
  // Throw the live transport away and build a new one from the factory, without
  // tearing down the consumers hanging off this provider. Callers use it to move
  // a chain onto a different transport — a light client to an RPC node, say —
  // while clients, subscriptions and refcounts stay where they are.
  //
  // The old transport closes synchronously; the new one does not. The swap goes
  // through the proxy's reconnect path, so the factory is called on its backoff
  // — 500 ms after this returns, and a step further out for each restart that
  // lands before the chain has delivered a message on the transport before it
  // (`getSyncProvider` counts those as a flapping connection). Next to opening a
  // socket or booting a light client the first step is noise, but a caller
  // driving this from a UI toggle should not treat it as instantaneous.
  restart(): void;
  // Forwarded to the current transport when it supports it; otherwise a no-op.
  pause(): void;
  resume(): void;
};

type ActiveTransport = {
  provider: JsonRpcProvider;
  // Closes the transport and makes `getSyncProvider` ask the factory for the
  // next one. Acts once per build.
  close(error?: unknown): void;
};

// A provider whose underlying transport can be replaced at any time.
//
// The swap is dressed up as a connection drop, which is the one event every
// layer above already knows how to survive: `getSyncProvider`'s proxy reports
// the active `chainHead` follows as stopped and re-sends the requests that were
// in flight, so polkadot-api re-follows on the new transport by itself, and the
// subscription-replay wrapper re-establishes the legacy subscriptions that
// `chainHead` bookkeeping does not cover. Consumers see the same interruption a
// dropped socket would have caused, and nothing above has to be rebuilt.
export function createRestartableProvider(
  createTransport: (onHalt: (error?: unknown) => void) => JsonRpcProvider,
): RestartableJsonRpcProvider {
  let active: ActiveTransport | null = null;
  let notifyReconnect: VoidFunction = noop;
  // Survives a restart: a transport built while the host has the pool paused
  // must come up paused too, or backgrounding the app would stop holding.
  let paused = false;

  const onReconnect = (callback: VoidFunction): VoidFunction => {
    notifyReconnect = callback;

    return () => {
      notifyReconnect = noop;
    };
  };

  const core = getSyncProvider(onResult => {
    let built = false;

    onResult((onMessage, halt) => {
      let provider: JsonRpcProvider;
      let connection: JsonRpcConnection;
      let transport: ActiveTransport | null = null;
      let closed = false;
      let haltedWhileBuilding = false;
      let haltError: unknown;

      // A transport that cannot recover by itself (a light client whose
      // connection is gone) halts its build, and the proxy owns the retry: it
      // stops the answered follows, re-sends what was in flight and rebuilds on
      // its backoff. A transport that recovers by itself never calls it.
      //
      // It must not throw: on the build path an error would abort the proxy's
      // connect before it re-sends its buffered requests.
      const onHalt = (error?: unknown) => {
        if (transport) {
          transport.close(error);
        } else if (!haltedWhileBuilding) {
          // The build is not registered yet, so the halt waits for it. A build
          // that then fails is halted by the failure path below.
          haltedWhileBuilding = true;
          haltError = error;
        }
      };

      try {
        provider = createTransport(onHalt);
        // Paused before the transport is handed its message callback: a
        // transport that opens its connection right there (a light client, say)
        // would otherwise be up for as long as it takes to pause it again,
        // which is the socket-behind-a-backgrounded-app this guards against.
        if (paused && isPausable(provider)) provider.pause();
        connection = provider(onMessage);
      } catch (error) {
        // The proxy is mid-connect and stores whatever we return here, so a
        // factory that throws has to be reported through `halt`: it puts the
        // proxy back to connecting — buffering sends rather than pushing them
        // at a transport that was never built — and schedules the next attempt.
        // Without it the chain would keep a live-looking client wired to
        // nothing, for good.
        halt(error);

        return { send: noop, disconnect: noop };
      }

      const current: ActiveTransport = {
        provider,
        close(error) {
          if (closed) return;
          closed = true;
          if (active === current) active = null;
          // Close before halting: the halt schedules the next `createTransport`,
          // and a transport left open would keep its socket (or light-client
          // slot) running alongside its replacement.
          try {
            connection.disconnect();
          } catch (disconnectError) {
            console.warn('[chain-connection] closing a transport failed', disconnectError);
          }
          halt(error);
        },
      };
      transport = current;

      if (haltedWhileBuilding) {
        current.close(haltError);

        return { send: noop, disconnect: noop };
      }

      active = current;
      built = true;

      return {
        send: message => connection.send(message),
        disconnect: () => {
          closed = true;
          if (active === current) active = null;
          connection.disconnect();
        },
      };
    });

    // `onResult` runs the proxy's connect synchronously, so a build that is up
    // by here has the proxy connected, and the replayed subscribes go out on it.
    // The replay already skips a subscription whose re-subscribe is still in
    // flight, because the proxy re-sends it. This guard covers the other case:
    // a build that failed, or was halted before it was registered, has no
    // transport to replay into, so the replay is skipped entirely.
    if (built && active) notifyReconnect();

    // Nothing to cancel: `onResult` above already resolved this attempt.
    return noop;
  });

  const provider = withSubscriptionReplay(core, onReconnect);

  return Object.assign(provider, {
    restart() {
      // Nothing to replace while the proxy is between transports — whatever it
      // asks the factory for next is already built from the current settings.
      active?.close();
    },
    pause() {
      paused = true;
      const transport = active?.provider;
      if (transport && isPausable(transport)) transport.pause();
    },
    resume() {
      paused = false;
      const transport = active?.provider;
      if (transport && isPausable(transport)) transport.resume();
    },
  });
}
