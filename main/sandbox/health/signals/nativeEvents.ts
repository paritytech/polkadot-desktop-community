import { type WebContents } from 'electron';

import { type HealthSignal } from '../types';

export type NativeEventBinder = {
  bind: (webContents: WebContents, webContentsId: number, emit: (signal: HealthSignal) => void) => () => void;
};

export function createNativeEventBinder(): NativeEventBinder {
  return {
    bind(webContents, _webContentsId, emit) {
      const onUnresponsive = () => emit({ source: 'native', verdict: 'unresponsive', reason: { kind: 'native-unresponsive' } });
      const onResponsive = () => emit({ source: 'native', verdict: 'responsive', reason: { kind: 'native-responsive' } });
      const onGone = (_event: unknown, details: { reason: string; exitCode: number }) =>
        emit({
          source: 'native',
          verdict: 'crashed',
          reason: { kind: 'crashed', nativeReason: details.reason, exitCode: details.exitCode },
        });
      webContents.on('unresponsive', onUnresponsive);
      webContents.on('responsive', onResponsive);
      webContents.on('render-process-gone', onGone);
      return () => {
        webContents.off('unresponsive', onUnresponsive);
        webContents.off('responsive', onResponsive);
        webContents.off('render-process-gone', onGone);
      };
    },
  };
}
