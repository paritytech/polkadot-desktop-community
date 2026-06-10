// IPC channels for forwarding webview lifecycle events from the main process
// to the shell renderer. Defined here so a typo in either side fails imports
// instead of silently dropping events on the floor.
export const WEBVIEW_RENDER_PROCESS_GONE = 'webview:render-process-gone';
export const WEBVIEW_RENDER_PROCESS_UNRESPONSIVE = 'webview:render-process-unresponsive';
export const WEBVIEW_RENDER_PROCESS_RESPONSIVE = 'webview:render-process-responsive';
export const WEBVIEW_HEALTH_STATE = 'webview:health-state';
