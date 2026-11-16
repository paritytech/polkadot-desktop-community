import { createNanoEvents } from 'nanoevents';

import { type ConnectionStatus } from './types';

export function createConnectionManager() {
  const events = createNanoEvents<{
    status: (params: { chainId: string; status: ConnectionStatus }) => void;
  }>();

  const connectionStatuses = new Map<string, ConnectionStatus>();

  events.on('status', ({ chainId, status }) => {
    connectionStatuses.set(chainId, status);
  });

  return {
    getConnectionStatus(chainId: string) {
      return connectionStatuses.get(chainId) ?? 'disconnected';
    },
    update(chainId: string, status: ConnectionStatus) {
      events.emit('status', { chainId, status });
    },
    onStatusChange(chainId: string, callback: (status: ConnectionStatus) => void) {
      const handler = (event: { chainId: string; status: ConnectionStatus }) => {
        if (event.chainId === chainId) {
          callback(event.status);
        }
      };

      return events.on('status', handler);
    },
  };
}
