import { ipcMain } from 'electron';
import { default as Store } from 'electron-store';

import { type UpdateChannel, DEFAULT_UPDATE_CHANNEL, UPDATE_CHANNEL } from './constants/store';

export function getUpdateChannel(): UpdateChannel {
  const store = new Store<Record<string, unknown>>({
    defaults: { [UPDATE_CHANNEL]: DEFAULT_UPDATE_CHANNEL },
  });
  const raw = store.get(UPDATE_CHANNEL);
  return raw === 'experimental' ? 'experimental' : 'stable';
}

export function registerUpdateChannelSyncIpc(): void {
  ipcMain.on('sync:getUpdateChannel', event => {
    event.returnValue = getUpdateChannel();
  });
}
