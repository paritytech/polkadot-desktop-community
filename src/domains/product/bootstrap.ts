import { bootstrapPermissions } from './permissions/bootstrap';

type BootstrapProductConfig = {
  /** Forwarded to permission wiring — see `bootstrapPermissions`. */
  promptForUnmatchedRemoteAccess: boolean;
};

// Wires the product domain to the host environment (IPC request handlers, etc.).
// Composes the per-module bootstraps and is the domain's public entry point —
// call it once from the app bootstrap, never at module-import time, so host
// wiring and its load order stay explicit.
export function bootstrapProduct(config: BootstrapProductConfig): void {
  bootstrapPermissions(config);
}
