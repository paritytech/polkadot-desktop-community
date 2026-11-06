// Session-scoped device-permission grants. "Allow once" must open the native
// getUserMedia gate (bootstrap.onDevicePermissionRequest) for the current product
// session WITHOUT persisting a durable 'granted'. This in-memory store is that
// channel — never persisted, consulted only by the native device gate, and cleared
// by the Webview widget when it disposes the product's core provider (close /
// leaving the product; a reload keeps it).
//
// This file holds no resource any more: the TrUAPI core owns every persisted
// permission decision, and the reads that used to live here are use-case methods
// over the core's API. These four functions stay because session state is not
// persistence, and moving them across layers is a separate decision.

import { type ExecutableKind } from '@parity/truapi-host';

import { type DevicePermissionType } from './types';

const transientDeviceGrants = new Set<string>();

type TransientDeviceGrantParams = {
  productId: string;
  permission: DevicePermissionType;
  executionKind: ExecutableKind;
};

function transientDeviceGrantKey({ productId, permission, executionKind }: TransientDeviceGrantParams): string {
  return `${productId}\0${permission}\0${executionKind}`;
}

export function grantTransientDevicePermission(params: TransientDeviceGrantParams): void {
  transientDeviceGrants.add(transientDeviceGrantKey(params));
}

export function getTransientDevicePermissionGranted(params: TransientDeviceGrantParams): boolean {
  return transientDeviceGrants.has(transientDeviceGrantKey(params));
}

export function clearTransientDevicePermissionGrants({
  productId,
  executionKind,
}: {
  productId: string;
  executionKind: ExecutableKind;
}): void {
  const prefix = `${productId}\0`;
  const suffix = `\0${executionKind}`;
  for (const key of transientDeviceGrants) {
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      transientDeviceGrants.delete(key);
    }
  }
}

// Test-only: drop all transient grants. Mirrors broker.ts's _resetRemotePermissionBroker.
export function _resetTransientDevicePermissionGrants(): void {
  transientDeviceGrants.clear();
}
