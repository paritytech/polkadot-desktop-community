import { type SocketLoggerFn, WsEvent, getWsProvider } from '@polkadot-api/ws-provider';
import { type JsonRpcProvider } from 'polkadot-api';

import { createPauseController } from './createPauseController';
import { noop } from './noop';
import { type ConnectionStatus } from './types';
import { withSubscriptionReplay } from './withSubscriptionReplay';

type PausableJsonRpcProvider = JsonRpcProvider & {
  pause(): void;
  resume(): void;
};

export function isPausable(provider: JsonRpcProvider): provider is PausableJsonRpcProvider {
  return (
    'pause' in provider && typeof provider.pause === 'function' && 'resume' in provider && typeof provider.resume === 'function'
  );
}

const STATUS_BY_WS_EVENT: Record<WsEvent, ConnectionStatus> = {
  [WsEvent.CONNECTING]: 'connecting',
  [WsEvent.CONNECTED]: 'connected',
  [WsEvent.ERROR]: 'disconnected',
  [WsEvent.CLOSE]: 'disconnected',
};

export function createWsJsonRpcProvider(options: {
  endpoints: string[];
  onStatusChanged?: (status: ConnectionStatus) => void;
  websocketClass?: typeof WebSocket;
  heartbeatTimeout?: number;
  connectionTimeout?: number;
  logger?: SocketLoggerFn;
}): PausableJsonRpcProvider {
  let notifyReconnect: VoidFunction = noop;
  const onReconnect = (cb: VoidFunction): VoidFunction => {
    notifyReconnect = cb;
    return () => {
      notifyReconnect = noop;
    };
  };

  const pauseController = createPauseController();

  const baseProvider: JsonRpcProvider = getWsProvider(options.endpoints, {
    logger: options.logger,
    // Forward only when defined: getWsProvider merges via `{...defaults, ...config}`,
    // so an explicit `undefined` clobbers the library's 40 s default and Node's
    // setTimeout clamps undefined/Infinity to 1 ms — which would kill every socket
    // right after open and drive a reconnect loop.
    ...(options.heartbeatTimeout !== undefined && { heartbeatTimeout: options.heartbeatTimeout }),
    ...(options.connectionTimeout !== undefined && { timeout: options.connectionTimeout }),
    middleware: inner => pauseController.middleware(inner),
    websocketClass: options.websocketClass,
    onStatusChanged: event => {
      const status = STATUS_BY_WS_EVENT[event.type];
      if (status === 'connected') {
        notifyReconnect();
      }
      options.onStatusChanged?.(status);
    },
  });

  const replayProvider = withSubscriptionReplay(baseProvider, onReconnect);

  return Object.assign(replayProvider, {
    pause: () => pauseController.pause(),
    resume: () => pauseController.resume(),
  });
}
