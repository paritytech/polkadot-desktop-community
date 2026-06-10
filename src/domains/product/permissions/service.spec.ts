import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import { type ProductExecutables } from '../product/manifest/types';

import { permissionsService } from './service';
import { type DevicePermission, type ProductPermissions, type RemotePermission, type RemotePermissionRequest } from './types';

describe('permissionsService.matchesUrlPermission', () => {
  it('matches exact hostname', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com', 'https://api.example.com/data')).toBe(true);
  });

  it('matches wildcard subdomain', () => {
    expect(permissionsService.matchesUrlPermission('https://*.example.com', 'https://api.example.com/data')).toBe(true);
  });

  it('does not match root domain when pattern has subdomain wildcard', () => {
    expect(permissionsService.matchesUrlPermission('https://*.example.com', 'https://example.com/data')).toBe(false);
  });

  it('does not match multi-level subdomain with single wildcard', () => {
    expect(permissionsService.matchesUrlPermission('https://*.example.com', 'https://a.b.example.com/data')).toBe(false);
  });

  it('does not match different domain', () => {
    expect(permissionsService.matchesUrlPermission('https://*.example.com', 'https://evil.com')).toBe(false);
  });

  it('does not match when protocol differs', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com', 'http://api.example.com')).toBe(false);
  });

  it('does not match wss pattern against https URL', () => {
    expect(permissionsService.matchesUrlPermission('wss://api.example.com', 'https://api.example.com/')).toBe(false);
  });

  it('does not match https pattern against wss URL', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com', 'wss://api.example.com/')).toBe(false);
  });

  it('matches wss pattern against wss URL with path', () => {
    expect(permissionsService.matchesUrlPermission('wss://api.example.com', 'wss://api.example.com/rpc')).toBe(true);
  });

  it('matches any path when pattern pathname is root', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com', 'https://api.example.com/some/deep/path')).toBe(
      true,
    );
  });

  it('matches path prefix when pattern has non-root path', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com/v1', 'https://api.example.com/v1/users')).toBe(true);
  });

  it('does not match when path prefix does not match', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com/v1', 'https://api.example.com/v2/users')).toBe(false);
  });

  it('returns false for invalid pattern URL', () => {
    expect(permissionsService.matchesUrlPermission('not-a-url', 'https://api.example.com')).toBe(false);
  });

  it('does not match when request path shares a prefix but has a different segment', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com/v1', 'https://api.example.com/v11/users')).toBe(
      false,
    );
  });

  it('matches when request path is exactly the pattern path', () => {
    expect(permissionsService.matchesUrlPermission('https://api.example.com/v1', 'https://api.example.com/v1')).toBe(true);
  });
});

describe('getRemotePermissionRequestStatus', () => {
  const base: ProductPermissions = {
    productId: 'coin-flip.dot',
    devicePermissions: [],
    remotePermissions: [],
  };

  it('returns denied for ChainSubmit when stored as denied', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'ChainSubmit' }, modality: 'app', status: 'denied' }],
    };

    expect(permissionsService.getRemotePermissionRequestStatus(permissions, { tag: 'ChainSubmit' }, 'app')).toBe('denied');
  });

  it('returns denied for StatementSubmit when stored as denied', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'StatementSubmit' }, modality: 'app', status: 'denied' }],
    };

    expect(permissionsService.getRemotePermissionRequestStatus(permissions, { tag: 'StatementSubmit' }, 'app')).toBe('denied');
  });

  it('returns denied for PreimageSubmit when stored as denied', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'PreimageSubmit' }, modality: 'app', status: 'denied' }],
    };

    expect(permissionsService.getRemotePermissionRequestStatus(permissions, { tag: 'PreimageSubmit' }, 'app')).toBe('denied');
  });

  it('returns granted for UserIdentity when stored as granted', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'UserIdentity' }, modality: 'app', status: 'granted' }],
    };

    expect(permissionsService.getRemotePermissionRequestStatus(permissions, { tag: 'UserIdentity' }, 'app')).toBe('granted');
  });

  it('returns denied for Remote when a matching pattern is denied', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'denied' }],
    };

    expect(
      permissionsService.getRemotePermissionRequestStatus(
        permissions,
        {
          tag: 'Remote',
          value: ['https://api.example.com/data'],
        },
        'app',
      ),
    ).toBe('denied');
  });

  it('returns undefined for Remote when no pattern matches the requested URLs', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'Remote', pattern: 'https://other.com' }, modality: 'app', status: 'granted' }],
    };

    expect(
      permissionsService.getRemotePermissionRequestStatus(
        permissions,
        { tag: 'Remote', value: ['https://api.example.com'] },
        'app',
      ),
    ).toBeUndefined();
  });

  // The enforcement gate is conservative (deny-wins) — the inverse of the
  // settings-display roll-up. These pin that asymmetry so a future refactor can't
  // silently flip the gate to grant-wins and wave a request past a denied pattern.
  it('returns granted for Remote only when every matching pattern is granted', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://api.example.com' }, modality: 'app', status: 'granted' },
        { payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'granted' },
      ],
    };

    expect(
      permissionsService.getRemotePermissionRequestStatus(
        permissions,
        { tag: 'Remote', value: ['https://api.example.com'] },
        'app',
      ),
    ).toBe('granted');
  });

  it('returns denied for Remote when matching patterns mix granted and denied (deny-wins)', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://api.example.com' }, modality: 'app', status: 'granted' },
        { payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'denied' },
      ],
    };

    expect(
      permissionsService.getRemotePermissionRequestStatus(
        permissions,
        { tag: 'Remote', value: ['https://api.example.com'] },
        'app',
      ),
    ).toBe('denied');
  });

  it('returns ask for Remote when matching patterns mix granted and ask (no denial)', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://api.example.com' }, modality: 'app', status: 'granted' },
        { payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'ask' },
      ],
    };

    expect(
      permissionsService.getRemotePermissionRequestStatus(
        permissions,
        { tag: 'Remote', value: ['https://api.example.com'] },
        'app',
      ),
    ).toBe('ask');
  });
});

describe('upsertRemotePermission', () => {
  const base: ProductPermissions = {
    productId: 'coin-flip.dot',
    devicePermissions: [],
    remotePermissions: [],
  };

  const apply = (permissions: ProductPermissions, permission: RemotePermission) =>
    produce(permissions, draft => {
      permissionsService.upsertRemotePermission(draft, permission);
    });

  it('inserts PreimageSubmit when no entry exists', () => {
    const updated = apply(base, { payload: { type: 'PreimageSubmit' }, modality: 'app', status: 'denied' });

    expect(updated.remotePermissions).toEqual([{ payload: { type: 'PreimageSubmit' }, modality: 'app', status: 'denied' }]);
  });

  it('updates existing StatementSubmit instead of appending a duplicate', () => {
    const existing: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'StatementSubmit' }, modality: 'app', status: 'ask' }],
    };

    const updated = apply(existing, { payload: { type: 'StatementSubmit' }, modality: 'app', status: 'denied' });

    expect(updated.remotePermissions).toEqual([{ payload: { type: 'StatementSubmit' }, modality: 'app', status: 'denied' }]);
  });

  it('updates Remote permission by pattern', () => {
    const existing: ProductPermissions = {
      ...base,
      remotePermissions: [{ payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'ask' }],
    };

    const updated = apply(existing, {
      payload: { type: 'Remote', pattern: 'https://*.example.com' },
      modality: 'app',
      status: 'denied',
    });

    expect(updated.remotePermissions).toEqual([
      { payload: { type: 'Remote', pattern: 'https://*.example.com' }, modality: 'app', status: 'denied' },
    ]);
  });
});

describe('permissionsService.upsertDevicePermission', () => {
  it('keeps entries of other modalities independent', () => {
    const perms: ProductPermissions = {
      productId: 'x.dot',
      devicePermissions: [{ payload: { name: 'Microphone' }, modality: 'app', status: 'granted' }],
      remotePermissions: [],
    };
    const next: DevicePermission = { payload: { name: 'Microphone' }, modality: 'widget', status: 'denied' };
    const updated = produce(perms, draft => permissionsService.upsertDevicePermission(draft, next));
    expect(updated.devicePermissions).toEqual([
      { payload: { name: 'Microphone' }, modality: 'app', status: 'granted' },
      { payload: { name: 'Microphone' }, modality: 'widget', status: 'denied' },
    ]);
  });

  it('updates the matching modality entry in place', () => {
    const perms: ProductPermissions = {
      productId: 'x.dot',
      devicePermissions: [
        { payload: { name: 'Microphone' }, modality: 'app', status: 'granted' },
        { payload: { name: 'Microphone' }, modality: 'widget', status: 'granted' },
      ],
      remotePermissions: [],
    };
    const next: DevicePermission = { payload: { name: 'Microphone' }, modality: 'widget', status: 'denied' };
    const updated = produce(perms, draft => permissionsService.upsertDevicePermission(draft, next));
    expect(updated.devicePermissions).toHaveLength(2);
    expect(updated.devicePermissions[0]?.status).toBe('granted');
    expect(updated.devicePermissions[1]?.status).toBe('denied');
  });
});

describe('buildRemotePermissionsToStore', () => {
  it('stores StatementSubmit under its own type', () => {
    expect(permissionsService.buildRemotePermissionsToStore({ tag: 'StatementSubmit' }, 'denied', 'app')).toEqual([
      { payload: { type: 'StatementSubmit' }, modality: 'app', status: 'denied' },
    ]);
  });

  it('stores PreimageSubmit under its own type', () => {
    expect(permissionsService.buildRemotePermissionsToStore({ tag: 'PreimageSubmit' }, 'denied', 'app')).toEqual([
      { payload: { type: 'PreimageSubmit' }, modality: 'app', status: 'denied' },
    ]);
  });
});

const STORED_DEVICE_SETTINGS_IDS = [
  'Microphone',
  'Camera',
  'Bluetooth',
  'Location',
  'Notifications',
  'Clipboard',
  'OpenExternalUrl',
  'Biometrics',
] as const;

describe('device permission settings mapping', () => {
  it('maps app-only device permissions from settings id to stored name', () => {
    expect(permissionsService.getDevicePermissionName('Notifications')).toBe('Notifications');
    expect(permissionsService.getDevicePermissionName('Clipboard')).toBe('Clipboard');
    expect(permissionsService.getDevicePermissionName('Biometrics')).toBe('Biometrics');
  });

  it('maps OpenExternalUrl settings id to OpenUrl device name', () => {
    expect(permissionsService.getDevicePermissionName('OpenExternalUrl')).toBe('OpenUrl');
    expect(permissionsService.getSettingsPermissionId('OpenUrl')).toBe('OpenExternalUrl');
  });

  it('round-trips settings id ↔ device name for every stored device permission', () => {
    for (const settingsId of STORED_DEVICE_SETTINGS_IDS) {
      const deviceName = permissionsService.getDevicePermissionName(settingsId);
      expect(deviceName).not.toBeNull();
      expect(permissionsService.getSettingsPermissionId(deviceName!)).toBe(settingsId);
    }
  });

  it('returns null for remote-only permission ids', () => {
    expect(permissionsService.getDevicePermissionName('ChainSubmit')).toBeNull();
    expect(permissionsService.getDevicePermissionName('WebRtc')).toBeNull();
  });

  it('returns null for Files (UI-only, not in host-api DevicePermission)', () => {
    expect(permissionsService.getDevicePermissionName('Files')).toBeNull();
    expect(permissionsService.isStoredAsDevicePermission('Files')).toBe(false);
  });

  it('returns device name unchanged for unmapped host-api device permissions', () => {
    expect(permissionsService.getSettingsPermissionId('NFC')).toBe('NFC');
  });

  it('detects permissions persisted as device permissions', () => {
    expect(permissionsService.isStoredAsDevicePermission('Notifications')).toBe(true);
    expect(permissionsService.isStoredAsDevicePermission('OpenExternalUrl')).toBe(true);
    expect(permissionsService.isStoredAsDevicePermission('ChainSubmit')).toBe(false);
  });
});

describe('getExternalRequestPermissions', () => {
  const base: ProductPermissions = {
    productId: 'playgroundtest.dot',
    devicePermissions: [],
    remotePermissions: [],
  };

  it('returns empty array when permissions is null', () => {
    expect(permissionsService.getExternalRequestPermissions(null)).toEqual([]);
  });

  it('returns empty array when there are no remote permissions', () => {
    expect(permissionsService.getExternalRequestPermissions(base)).toEqual([]);
  });

  it('returns only ExternalRequest entries, preserving order', () => {
    const permissions: ProductPermissions = {
      ...base,
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://auth.coingecko.com/' }, modality: 'app', status: 'granted' },
        { payload: { type: 'ChainSubmit' }, modality: 'app', status: 'granted' },
        { payload: { type: 'Remote', pattern: 'https://api.twitter.com/' }, modality: 'app', status: 'denied' },
      ],
    };

    const result = permissionsService.getExternalRequestPermissions(permissions);

    expect(result).toEqual([
      { payload: { type: 'Remote', pattern: 'https://auth.coingecko.com/' }, modality: 'app', status: 'granted' },
      { payload: { type: 'Remote', pattern: 'https://api.twitter.com/' }, modality: 'app', status: 'denied' },
    ]);
  });
});

const appEntry = { identifier: 'app.x', contenthash: '0x00' as const };

describe('permissionsService.permissionModalitiesForProduct', () => {
  it('returns modalities declared by the manifest, worker excluded', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const executables = { app: appEntry, widget: appEntry, worker: appEntry } as unknown as ProductExecutables;
    expect(permissionsService.permissionModalitiesForProduct(executables, null)).toEqual(['app', 'widget']);
  });

  it('falls back to modalities present in stored entries when the manifest is unavailable', () => {
    const stored: ProductPermissions = {
      productId: 'x.dot',
      devicePermissions: [{ payload: { name: 'Camera' }, modality: 'widget', status: 'granted' }],
      remotePermissions: [],
    };
    expect(permissionsService.permissionModalitiesForProduct(null, stored)).toEqual(['widget']);
  });

  it('falls back to [app] when nothing is known', () => {
    expect(permissionsService.permissionModalitiesForProduct(null, null)).toEqual(['app']);
  });
});

describe('permissionsService.getPermissionStatusForModality', () => {
  const perms: ProductPermissions = {
    productId: 'x.dot',
    devicePermissions: [
      { payload: { name: 'Microphone' }, modality: 'app', status: 'granted' },
      { payload: { name: 'Microphone' }, modality: 'widget', status: 'denied' },
    ],
    remotePermissions: [{ payload: { type: 'ChainSubmit' }, modality: 'app', status: 'granted' }],
  };

  it('reads the status of the requested modality only', () => {
    expect(permissionsService.getPermissionStatusForModality(perms, 'Microphone', 'app')).toBe('granted');
    expect(permissionsService.getPermissionStatusForModality(perms, 'Microphone', 'widget')).toBe('denied');
  });

  it('returns ask for an absent modality entry', () => {
    expect(permissionsService.getPermissionStatusForModality(perms, 'ChainSubmit', 'widget')).toBe('ask');
  });
});

describe('permissionsService.getRemotePermissionRequestStatus with modality', () => {
  const perms: ProductPermissions = {
    productId: 'x.dot',
    devicePermissions: [],
    remotePermissions: [{ payload: { type: 'Remote', pattern: 'https://api.example.com' }, modality: 'app', status: 'granted' }],
  };

  it('does not leak an app grant to the widget modality', () => {
    const request: RemotePermissionRequest = { tag: 'Remote', value: ['https://api.example.com/data'] };
    expect(permissionsService.getRemotePermissionRequestStatus(perms, request, 'app')).toBe('granted');
    expect(permissionsService.getRemotePermissionRequestStatus(perms, request, 'widget')).toBeUndefined();
  });
});

describe('permissionsService.aggregatePermission allowedModalities', () => {
  it('reports modalities with granted status and rolls statuses up', () => {
    const all: ProductPermissions[] = [
      {
        productId: 'x.dot',
        devicePermissions: [
          { payload: { name: 'Microphone' }, modality: 'app', status: 'denied' },
          { payload: { name: 'Microphone' }, modality: 'widget', status: 'granted' },
        ],
        remotePermissions: [],
      },
    ];
    const aggregated = permissionsService.aggregatePermission('Microphone', all);
    expect(aggregated?.apps[0]?.allowedModalities).toEqual(['widget']);
    expect(aggregated?.apps[0]?.status).toBe('granted');
  });

  it('reports ExternalRequest modalities with at least one granted pattern, with per-pattern modality', () => {
    const all: ProductPermissions[] = [
      {
        productId: 'x.dot',
        devicePermissions: [],
        remotePermissions: [
          { payload: { type: 'Remote', pattern: 'https://a.com' }, modality: 'app', status: 'granted' },
          { payload: { type: 'Remote', pattern: 'https://b.com' }, modality: 'widget', status: 'denied' },
        ],
      },
    ];
    const aggregated = permissionsService.aggregatePermission('ExternalRequest', all);
    expect(aggregated?.apps[0]?.allowedModalities).toEqual(['app']);
    expect(aggregated?.apps[0]?.patterns).toEqual([
      { pattern: 'https://a.com', modality: 'app', status: 'granted' },
      { pattern: 'https://b.com', modality: 'widget', status: 'denied' },
    ]);
  });
});

describe('permissionsService.getDevicePermissionStatus', () => {
  const perms: ProductPermissions = {
    productId: 'x.dot',
    devicePermissions: [
      { payload: { name: 'Camera' }, modality: 'app', status: 'granted' },
      { payload: { name: 'Camera' }, modality: 'widget', status: 'denied' },
    ],
    remotePermissions: [],
  };

  it('returns the stored status for the matching device name and modality', () => {
    expect(permissionsService.getDevicePermissionStatus(perms, 'Camera', 'app')).toBe('granted');
    expect(permissionsService.getDevicePermissionStatus(perms, 'Camera', 'widget')).toBe('denied');
  });

  it('returns undefined when no entry matches the device name', () => {
    expect(permissionsService.getDevicePermissionStatus(perms, 'Microphone', 'app')).toBeUndefined();
  });

  it('returns undefined for null permissions', () => {
    expect(permissionsService.getDevicePermissionStatus(null, 'Camera', 'app')).toBeUndefined();
  });
});

describe('permissionsService.modalityForKind', () => {
  it.each([
    ['app', 'app'],
    ['widget', 'widget'],
    // worker is an executable kind but NOT a modality — enforced against 'app'.
    ['worker', 'app'],
  ] as const)('modalityForKind(%j) → %j', (kind, modality) => {
    expect(permissionsService.modalityForKind(kind)).toBe(modality);
  });
});

describe('permissionsService.removePermissionEntries', () => {
  it('removes all modalities of a device permission', () => {
    const perms: ProductPermissions = {
      productId: 'x.dot',
      devicePermissions: [
        { payload: { name: 'Microphone' }, modality: 'app', status: 'granted' },
        { payload: { name: 'Microphone' }, modality: 'widget', status: 'denied' },
        { payload: { name: 'Camera' }, modality: 'app', status: 'granted' },
      ],
      remotePermissions: [],
    };
    const updated = produce(perms, draft => permissionsService.removePermissionEntries(draft, 'Microphone'));
    expect(updated.devicePermissions).toEqual([{ payload: { name: 'Camera' }, modality: 'app', status: 'granted' }]);
  });

  it('reverts every Remote pattern to "ask" for ExternalRequest, keeping the stored domain list', () => {
    const perms: ProductPermissions = {
      productId: 'x.dot',
      devicePermissions: [],
      remotePermissions: [
        { payload: { type: 'Remote', pattern: 'https://a.com' }, modality: 'app', status: 'granted' },
        { payload: { type: 'Remote', pattern: 'https://b.com' }, modality: 'widget', status: 'denied' },
        { payload: { type: 'ChainSubmit' }, modality: 'app', status: 'granted' },
      ],
    };
    const updated = produce(perms, draft => permissionsService.removePermissionEntries(draft, 'ExternalRequest'));
    expect(updated.remotePermissions).toEqual([
      { payload: { type: 'Remote', pattern: 'https://a.com' }, modality: 'app', status: 'ask' },
      { payload: { type: 'Remote', pattern: 'https://b.com' }, modality: 'widget', status: 'ask' },
      { payload: { type: 'ChainSubmit' }, modality: 'app', status: 'granted' },
    ]);
  });
});

describe('permissionsService.aggregatePermissions', () => {
  it('includes apps with ask status after allow-once persistence', () => {
    const all: ProductPermissions[] = [
      {
        productId: 'example.dot',
        devicePermissions: [{ payload: { name: 'Bluetooth' }, modality: 'app', status: 'ask' }],
        remotePermissions: [],
      },
    ];

    const aggregated = permissionsService.aggregatePermission('Bluetooth', all);

    expect(aggregated?.apps).toHaveLength(1);
    expect(aggregated?.apps[0]?.status).toBe('ask');
    expect(aggregated?.grantedCount).toBe(0);
  });
});
