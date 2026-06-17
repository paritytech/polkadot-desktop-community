import { filter, firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./resource', () => ({
  productPermissionsResource: {
    read$: vi.fn(),
  },
  getTransientDevicePermissionGranted: vi.fn(() => false),
}));

import { bootstrapPermissions } from './bootstrap';
import { _resetRemotePermissionBroker, pendingRemotePermissionRequests$ } from './broker';
import { getTransientDevicePermissionGranted, productPermissionsResource } from './resource';
import { type PermissionStatus, type ProductPermissions, type RemotePermissionIpcRequest } from './types';

type RemoteHandler = (request: RemotePermissionIpcRequest) => Promise<PermissionStatus>;
type DeviceHandler = (request: {
  productId: string;
  permission: 'Camera' | 'Microphone';
  executable: 'app' | 'widget';
}) => Promise<PermissionStatus>;

let remoteHandler: RemoteHandler | undefined;
let deviceHandler: DeviceHandler | undefined;

function buildPermissions(remotePermissions: ProductPermissions['remotePermissions']): ProductPermissions {
  return { productId: 'p.dot', devicePermissions: [], remotePermissions };
}

function remoteRequest(url: string): RemotePermissionIpcRequest {
  return { productId: 'p.dot', executable: 'app', request: { tag: 'Remote', url } };
}

beforeEach(() => {
  _resetRemotePermissionBroker();
  remoteHandler = undefined;
  deviceHandler = undefined;
  vi.mocked(getTransientDevicePermissionGranted).mockReturnValue(false);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
  (globalThis as any).window = {
    App: {
      onDevicePermissionRequest: vi.fn((handler: DeviceHandler) => {
        deviceHandler = handler;
      }),
      onRemotePermissionRequest: vi.fn((handler: RemoteHandler) => {
        remoteHandler = handler;
      }),
    },
  };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
  delete (globalThis as any).window;
});

describe('bootstrapPermissions — remote permission gate', () => {
  it('prompts the user when the matching stored pattern is "ask"', async () => {
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of(buildPermissions([{ payload: { type: 'Remote', pattern: 'https://cdn.example.com' }, modality: 'app', status: 'ask' }])),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    const pendingPromise = firstValueFrom(pendingRemotePermissionRequests$.pipe(filter(list => list.length > 0)));
    const decision = remoteHandler?.(remoteRequest('https://cdn.example.com/x.png'));

    const [prompt] = await pendingPromise;
    prompt?.resolve('granted');

    await expect(decision).resolves.toBe('granted');
  });

  it('prompts when overlapping matches roll up to "ask" (some granted, some ask)', async () => {
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of(
        buildPermissions([
          { payload: { type: 'Remote', pattern: 'https://cdn.example.com' }, modality: 'app', status: 'granted' },
          { payload: { type: 'Remote', pattern: 'https://cdn.example.com/x.png' }, modality: 'app', status: 'ask' },
        ]),
      ),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    const pendingPromise = firstValueFrom(pendingRemotePermissionRequests$.pipe(filter(list => list.length > 0)));
    const decision = remoteHandler?.(remoteRequest('https://cdn.example.com/x.png'));

    const [prompt] = await pendingPromise;
    prompt?.resolve('denied');

    await expect(decision).resolves.toBe('denied');
  });

  it('returns a stored "granted" decision without prompting', async () => {
    const emitted: unknown[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of(
        buildPermissions([
          { payload: { type: 'Remote', pattern: 'https://cdn.example.com' }, modality: 'app', status: 'granted' },
        ]),
      ),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    await expect(remoteHandler?.(remoteRequest('https://cdn.example.com/x.png'))).resolves.toBe('granted');

    expect(emitted.every(list => list.length === 0)).toBe(true);
    sub.unsubscribe();
  });

  it('returns a stored "denied" decision without prompting', async () => {
    const emitted: unknown[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of(
        buildPermissions([
          { payload: { type: 'Remote', pattern: 'https://cdn.example.com' }, modality: 'app', status: 'denied' },
        ]),
      ),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    await expect(remoteHandler?.(remoteRequest('https://cdn.example.com/x.png'))).resolves.toBe('denied');

    expect(emitted.every(list => list.length === 0)).toBe(true);
    sub.unsubscribe();
  });

  it('denies a stored "ask" without prompting when prompts are disabled', async () => {
    const emitted: unknown[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of(buildPermissions([{ payload: { type: 'Remote', pattern: 'https://cdn.example.com' }, modality: 'app', status: 'ask' }])),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: false });

    await expect(remoteHandler?.(remoteRequest('https://cdn.example.com/x.png'))).resolves.toBe('denied');

    expect(emitted.every(list => list.length === 0)).toBe(true);
    sub.unsubscribe();
  });
});

describe('bootstrapPermissions — device permission gate', () => {
  it('returns "granted" when a transient grant exists, without reading persisted status', async () => {
    vi.mocked(getTransientDevicePermissionGranted).mockReturnValue(true);
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });
    // This file has no clearAllMocks in beforeEach; isolate read$'s call history so
    // the assertion measures only the device handler's behavior.
    vi.mocked(productPermissionsResource.read$).mockClear();

    await expect(deviceHandler?.({ productId: 'p.dot', permission: 'Camera', executable: 'app' })).resolves.toBe('granted');
    expect(productPermissionsResource.read$).not.toHaveBeenCalled();
  });

  it('falls through to persisted status when there is no transient grant', async () => {
    vi.mocked(getTransientDevicePermissionGranted).mockReturnValue(false);
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of({
        productId: 'p.dot',
        devicePermissions: [{ payload: { name: 'Camera' }, modality: 'app', status: 'granted' }],
        remotePermissions: [],
      }),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    await expect(deviceHandler?.({ productId: 'p.dot', permission: 'Camera', executable: 'app' })).resolves.toBe('granted');
  });

  it('returns "ask" when neither transient nor persisted grant exists', async () => {
    vi.mocked(getTransientDevicePermissionGranted).mockReturnValue(false);
    vi.mocked(productPermissionsResource.read$).mockReturnValue(
      of({ productId: 'p.dot', devicePermissions: [], remotePermissions: [] }),
    );
    bootstrapPermissions({ promptForUnmatchedRemoteAccess: true });

    await expect(deviceHandler?.({ productId: 'p.dot', permission: 'Camera', executable: 'app' })).resolves.toBe('ask');
  });
});
