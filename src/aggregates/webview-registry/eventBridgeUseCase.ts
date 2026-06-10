import { isElectron } from '@/shared/env';

import { webviewRegistry } from './state/registry';

/**
 * Wires Electron native webview events (crash / unresponsive / health) into
 * the aggregate's registry state. The aggregate owns the cross-feature view
 * of webview health; this use case is the input pipe that keeps it current.
 */
function start(): void {
  if (!isElectron()) return;

  window.App.onWebviewCrashed?.(info => webviewRegistry.markCrashed(info));
  window.App.onWebviewUnresponsive?.(info => webviewRegistry.markUnresponsive(info));
  window.App.onWebviewResponsive?.(info => webviewRegistry.clearUnresponsive(info.webContentsId));
  window.App.onWebviewHealthState?.(event => {
    webviewRegistry.setHealth({
      webContentsId: event.webContentsId,
      productId: event.productId,
      state: event.state,
      reason: event.reason,
      since: event.at,
    });
    // Bridge to legacy slices so existing CrashOverlay/UnresponsiveOverlay react
    // to the monitor's earlier detection (heartbeat-timeout typically fires
    // before Electron's native `unresponsive` event).
    if (event.state === 'unresponsive') {
      webviewRegistry.markUnresponsive({ webContentsId: event.webContentsId, url: '', at: event.at });
    } else {
      webviewRegistry.clearUnresponsive(event.webContentsId);
    }
    if (event.state === 'crashed') {
      const rawNativeReason = event.reason['nativeReason'];
      const rawExitCode = event.reason['exitCode'];
      const nativeReason = typeof rawNativeReason === 'string' ? rawNativeReason : undefined;
      const exitCode = typeof rawExitCode === 'number' ? rawExitCode : 0;
      webviewRegistry.markCrashed({
        webContentsId: event.webContentsId,
        url: '',
        reason: nativeReason ?? event.reason.kind,
        exitCode,
        at: event.at,
      });
    }
  });
}

export const eventBridgeUseCase = {
  start,
};
