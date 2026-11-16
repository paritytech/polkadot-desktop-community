import { createNanoEvents } from 'nanoevents';
import { type JsonRpcProvider } from 'polkadot-api';

import { createRefCounter } from './createRefCounter';
import { type BranchedProvider } from './types';

type JsonRpcConnection = ReturnType<JsonRpcProvider>;
type JsonRpcMessage = Parameters<Parameters<JsonRpcProvider>[0]>[0];

type Params = {
  enhanceBranch?(branch: JsonRpcProvider): JsonRpcProvider;
};

export function createBranchedProvider(provider: JsonRpcProvider, params?: Params): BranchedProvider {
  const enhancer = params?.enhanceBranch ?? (provider => provider);

  const messages = createNanoEvents<{ incoming: (v: JsonRpcMessage) => void }>();
  const refs = createRefCounter<'connection'>();
  let connection: JsonRpcConnection | null = null;

  return {
    branch(onDisconnect): JsonRpcProvider {
      return enhancer(onMessage => {
        if (!connection) {
          connection = provider(message => messages.emit('incoming', message));
        }

        const unsub = messages.on('incoming', onMessage);

        refs.increment('connection');

        return {
          send(message) {
            connection?.send(message);
          },
          disconnect() {
            if (refs.decrement('connection') === 0) {
              connection?.disconnect();
              connection = null;
            }

            onDisconnect?.();
            unsub();
          },
        };
      });
    },
  };
}
