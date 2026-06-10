import { eventBridgeUseCase } from './eventBridgeUseCase';

export { webviewRegistry } from './state/registry';
export { eventBridgeUseCase as webviewEventBridgeUseCase } from './eventBridgeUseCase';
export { useWebviewCrash, useWebviewHealth, useWebviewUnresponsive } from './hooks';
export {
  type WebviewCrashInfo,
  type WebviewHealthEntry,
  type WebviewHealthReason,
  type WebviewHealthState,
  type WebviewUnresponsiveInfo,
} from './types';

// Wire native webview events into registry state at module load.
eventBridgeUseCase.start();
