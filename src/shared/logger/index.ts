const noop = () => {};

/**
 * Replaces `console.debug` with a no-op for the rest of the app lifetime.
 * `debug` is the app's verbose diagnostics level (e.g. the WebRTC traces in
 * device-sync / peer-channel) — modules keep calling `console.debug` as usual
 * and the caller decides once, at startup, whether that output is wanted.
 * All other console methods are never touched.
 *
 * Call it after any console wrapper is installed (e.g. the renderer→file
 * forwarding in `src/index.tsx`) so the silenced method stays silenced
 * everywhere, including forwarded sinks.
 */
export function silenceDebugConsole(): void {
  console.debug = noop;
}
