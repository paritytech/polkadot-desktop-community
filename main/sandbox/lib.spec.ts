import { describe, expect, it } from 'vitest';

import {
  type ElectronSandboxPermissions,
  buildSandboxPartition,
  evaluateNetworkRequest,
  isAllowedHostNavigation,
  isExternalUrlAllowed,
  listClearablePartitions,
  mapElectronPermission,
  matchesDomain,
  parseHostAllowlist,
  parseProductLocalhostPort,
  parseSandboxPartition,
  resolveArchiveContent,
  resolveSandboxWillNavigate,
  sanitizeWebPreferences,
  validateArchiveDomain,
  validateArchiveFilePath,
  validateContenthash,
} from './lib';

// Structural fixture type for sanitizeWebPreferences tests
type SandboxPrefsFixture = {
  nodeIntegration?: boolean;
  nodeIntegrationInWorker?: boolean;
  preload?: string;
  contextIsolation?: boolean;
  sandbox?: boolean;
};

describe('validateContenthash', () => {
  it.each([
    ['0x1220abcdef', true],
    ['QmValidLookingCid', true],
    ['', false],
    ['../escape', false],
    ['a/b', false],
    ['a\\b', false],
    ['c:win', false],
    ['has\0null', false],
    ['..', false],
  ] as const)('validateContenthash(%j).ok → %j', (input, ok) => {
    expect(validateContenthash(input).ok).toBe(ok);
  });

  it('rejects non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- exercising the runtime guard with a non-string
    expect(validateContenthash(undefined as unknown as string).ok).toBe(false);
  });
});

describe('parseSandboxPartition', () => {
  it.each([
    ['sandbox-app-foo.dot', { productId: 'foo.dot', executable: 'app' }],
    ['sandbox-widget-foo.dot', { productId: 'foo.dot', executable: 'widget' }],
    ['sandbox-app-foo%2Ebar', { productId: 'foo.bar', executable: 'app' }],
    ['sandbox-app-foo%20bar', { productId: 'foo bar', executable: 'app' }],
    ['sandbox-app-', { productId: '', executable: 'app' }],
    // A productId that ends in the legacy '--widget' suffix is unambiguous now: it
    // sits entirely after the slot delimiter and stays an APP partition.
    ['sandbox-app-foo--widget', { productId: 'foo--widget', executable: 'app' }],
    ['persist:something', null],
    ['', null],
    ['sandbox-app-foo%', null], // malformed percent-encoding → null (hardening vs. throw)
    ['sandbox-foo.dot', null], // no slot delimiter → malformed
    ['sandbox-pocket-foo.dot', null], // unknown slot → malformed
  ] as const)('parseSandboxPartition(%j) → %j', (input, expected) => {
    expect(parseSandboxPartition(input)).toEqual(expected);
  });
});

describe('sandbox partition round-trip', () => {
  it.each([
    ['foo.dot', 'app'],
    ['foo.dot', 'widget'],
    // The exact ids that aliased onto each other under the old suffix scheme.
    ['foo--widget', 'app'],
    ['foo', 'widget'],
    ['localhost:5173', 'app'],
    ['foo/bar', 'app'],
    ['', 'app'],
  ] as const)('build → parse round-trips %j (%s)', (id, kind) => {
    expect(parseSandboxPartition(buildSandboxPartition(id, kind))).toEqual({ productId: id, executable: kind });
  });

  it("keeps an app id ending in --widget distinct from another product's widget partition", () => {
    // The old `sandbox-<id>[--widget]` format made these two collide.
    expect(buildSandboxPartition('foo--widget', 'app')).not.toBe(buildSandboxPartition('foo', 'widget'));
  });

  it('routes the headless worker executable to the app slot', () => {
    expect(buildSandboxPartition('foo.dot', 'worker')).toBe(buildSandboxPartition('foo.dot', 'app'));
  });
});

describe('listClearablePartitions', () => {
  it('returns only the partitions that were actually configured for the product', () => {
    const configured = new Set(['sandbox-app-foo.dot']);
    expect(listClearablePartitions('foo.dot', configured)).toEqual(['sandbox-app-foo.dot']);
  });

  it('includes the widget partition when it was configured', () => {
    const configured = new Set(['sandbox-app-foo.dot', 'sandbox-widget-foo.dot']);
    expect(listClearablePartitions('foo.dot', configured)).toEqual(['sandbox-app-foo.dot', 'sandbox-widget-foo.dot']);
  });

  it('returns nothing for a product with no configured partitions', () => {
    const configured = new Set(['sandbox-app-other.dot']);
    expect(listClearablePartitions('foo.dot', configured)).toEqual([]);
  });
});

describe('parseProductLocalhostPort', () => {
  it.each([
    // Bare identifier (the actual partition encoding) — must round-trip.
    ['localhost:5173', '5173'],
    ['localhost:8080', '8080'],
    ['localhost', ''],
    // Legacy URL form still accepted.
    ['http://localhost:5173', '5173'],
    ['http://localhost', ''],
    ['http://localhost:5173/path', '5173'],
    // Non-localhost identifiers must not be treated as localhost products.
    ['foo.dot', null],
    ['localhost.evil.com', null],
    ['localhost.evil.com:80', null],
    // Junk inputs.
    [null, null],
    ['', null],
  ] as const)('parseProductLocalhostPort(%j) → %j', (input, expected) => {
    expect(parseProductLocalhostPort(input)).toBe(expected);
  });
});

describe('validateArchiveDomain', () => {
  it.each([
    ['foo.dot', { ok: true, domain: 'foo.dot' }],
    ['foo.dot.evil.com', { ok: true, domain: 'foo.dot.evil.com' }], // length not enforced — documented quirk
    ['', { ok: false, error: 'Invalid domain' }],
    [123, { ok: false, error: 'Invalid domain' }],
    [null, { ok: false, error: 'Invalid domain' }],
    [undefined, { ok: false, error: 'Invalid domain' }],
    ['foo/bar', { ok: false, error: 'Invalid domain characters' }],
    ['foo\\bar', { ok: false, error: 'Invalid domain characters' }],
    ['foo:bar', { ok: false, error: 'Invalid domain characters' }],
    ['foo\0bar', { ok: false, error: 'Invalid domain characters' }],
    ['../foo', { ok: false, error: 'Invalid domain characters' }], // leading slash triggers char check
  ] as const)('validateArchiveDomain(%j) → %j', (input, expected) => {
    expect(validateArchiveDomain(input)).toEqual(expected);
  });
});

describe('validateArchiveFilePath', () => {
  it.each([
    ['assets/index.js', { ok: true }],
    ['index.html', { ok: true }],
    ['foo..bar', { ok: true }], // double-dot mid-token — documented quirk
    // 'foo/.../bar'.includes('../') is true (substring '.../bar' contains '../')
    // so this is rejected — the spec table comment was wrong; we match index.ts behavior
    ['foo/.../bar', { ok: false, error: 'Invalid file path: foo/.../bar' }],
    ['', { ok: false, error: 'Invalid file path: empty' }],
    ['../etc/passwd', { ok: false, error: 'Invalid file path: ../etc/passwd' }],
    ['foo/../bar', { ok: false, error: 'Invalid file path: foo/../bar' }],
    ['/etc/passwd', { ok: false, error: 'Invalid file path: /etc/passwd' }],
    ['foo\\bar', { ok: false, error: 'Invalid file path: foo\\bar' }],
    ['foo\0bar', { ok: false, error: 'Invalid file path: foo\0bar' }],
  ] as const)('validateArchiveFilePath(%j) → %j', (input, expected) => {
    expect(validateArchiveFilePath(input)).toEqual(expected);
  });
});

describe('matchesDomain', () => {
  it.each([
    ['relay.example.com', ['relay.example.com'], true],
    ['sub.relay.example.com', ['relay.example.com'], true],
    ['a.b.relay.example.com', ['relay.example.com'], true],
    ['attacker-relay.example.com', ['relay.example.com'], false], // prefix-attack
    ['relay.example.com.evil.com', ['relay.example.com'], false], // suffix-attack
    ['RELAY.EXAMPLE.COM', ['relay.example.com'], false], // case-sensitive — current behavior
    ['', ['relay.example.com'], false], // empty hostname
    ['relay.example.com', [], false], // empty allowlist
  ] as const)('matchesDomain(%j, %j) → %s', (hostname, allowed, expected) => {
    expect(matchesDomain(hostname, [...allowed])).toBe(expected);
  });
});

describe('parseHostAllowlist', () => {
  it.each([
    [undefined, []],
    ['', []],
    ['   ', []],
    ['relay.example.com', ['relay.example.com']],
    ['relay.example.com,stun.example.com', ['relay.example.com', 'stun.example.com']],
    [' relay.example.com , stun.example.com ', ['relay.example.com', 'stun.example.com']],
    ['relay.example.com,,stun.example.com', ['relay.example.com', 'stun.example.com']], // empty entries dropped
    ['ipfs-a.example.com,ipfs-b.example.com', ['ipfs-a.example.com', 'ipfs-b.example.com']],
    [',,,', []],
  ] as const)('parseHostAllowlist(%j) → %j', (input, expected) => {
    expect(parseHostAllowlist(input)).toEqual(expected);
  });
});

describe('evaluateNetworkRequest', () => {
  const IPFS = ['ipfs.dotspark.app', 'paseo-ipfs.polkadot.io', 'paseo-bulletin-next-ipfs.polkadot.io'];
  const RELAY = ['relay.example.com', 'stun.example.com'];

  function req(
    scheme: 'http' | 'https' | 'ws' | 'wss',
    method: string,
    urlString: string,
    productLocalhostPort: string | null = null,
  ) {
    return {
      scheme,
      method,
      url: new URL(urlString),
      ipfsAllowlist: IPFS,
      relayAllowlist: RELAY,
      productLocalhostPort,
    };
  }

  it.each([
    // IPFS allowlist — GET only
    [req('https', 'GET', 'https://ipfs.dotspark.app/file'), 'fetch-direct'],
    [req('https', 'POST', 'https://ipfs.dotspark.app/file'), 'check-permission'],
    [req('https', 'GET', 'https://paseo-ipfs.polkadot.io/file'), 'fetch-direct'],
    [req('https', 'GET', 'https://paseo-bulletin-next-ipfs.polkadot.io'), 'fetch-direct'],
    [req('https', 'GET', 'https://sub.ipfs.dotspark.app/file'), 'fetch-direct'],
    // Relay allowlist — method-agnostic
    [req('https', 'GET', 'https://relay.example.com/'), 'fetch-direct'],
    [req('https', 'POST', 'https://relay.example.com/'), 'fetch-direct'],
    // Sentry inline rule — substring match (documented quirk)
    [req('https', 'GET', 'https://app.sentry.io/'), 'fetch-direct'],
    // QUIRK: .includes('sentry.io') so 'sentry.io.attacker.com'.includes('sentry.io') is true → fetch-direct
    [req('https', 'GET', 'https://evil-sentry.io.attacker.com/'), 'fetch-direct'],
    // Generic https — blocked unless permission
    [req('https', 'GET', 'https://evil.com/'), 'check-permission'],
    // http localhost — only when product is itself localhost on the same port
    [req('http', 'GET', 'http://localhost/', null), 'check-permission'],
    [req('http', 'GET', 'http://localhost:5173/', null), 'check-permission'],
    [req('http', 'GET', 'http://localhost:5173/', '5173'), 'fetch-direct'],
    [req('http', 'GET', 'http://localhost/', ''), 'fetch-direct'],
    [req('http', 'GET', 'http://localhost:5173/', '8080'), 'check-permission'],
    [req('http', 'GET', 'http://evil.com/', null), 'check-permission'],
    [req('http', 'GET', 'http://evil.com/', '5173'), 'check-permission'],
    // ws localhost — same port-scoped rule
    [req('ws', 'GET', 'ws://localhost/', null), 'check-permission'],
    [req('ws', 'GET', 'ws://localhost:5173/', '5173'), 'fetch-direct'],
    [req('ws', 'GET', 'ws://localhost:5173/', '8080'), 'check-permission'],
    [req('ws', 'GET', 'ws://evil.com/'), 'check-permission'],
    // wss — ALWAYS check-permission (including localhost — documented quirk)
    [req('wss', 'GET', 'wss://localhost/'), 'check-permission'],
    [req('wss', 'GET', 'wss://localhost:5173/', '5173'), 'check-permission'],
    [req('wss', 'GET', 'wss://evil.com/'), 'check-permission'],
  ] as const)('evaluateNetworkRequest(%o) → %s', (args, expected) => {
    expect(evaluateNetworkRequest(args)).toBe(expected);
  });
});

describe('resolveArchiveContent', () => {
  const enc = new TextEncoder();

  function makeArchive(files: Record<string, string>) {
    return {
      domain: 'app.dot',
      origin: 'polkadot://app.dot',
      files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, enc.encode(v)])),
    };
  }

  const archive = makeArchive({
    'index.html': '<html>',
    'foo/index.html': 'foo-index',
    'about.html': 'about',
    '404.html': '<not-found>',
  });

  const archiveNo404 = makeArchive({
    'index.html': '<html>',
  });

  const decode = (v: Uint8Array | string): string => (v instanceof Uint8Array ? new TextDecoder().decode(v) : v);

  it.each([
    // Root resolves to index.html
    ['polkadot://app.dot/', 200, '<html>'],
    // Explicit file
    ['polkadot://app.dot/about.html', 200, 'about'],
    // No extension → try foo/index.html
    ['polkadot://app.dot/foo', 200, 'foo-index'],
    // Trailing slash → same as no extension
    ['polkadot://app.dot/foo/', 200, 'foo-index'],
    // No extension and no dir/index.html → fall back to root index.html
    ['polkadot://app.dot/foo/bar', 200, '<html>'],
    // Has extension but missing → 404 with 404.html content
    ['polkadot://app.dot/missing.css', 404, '<not-found>'],
  ])('resolveArchiveContent(%s) → status %s', (urlStr, expectedStatus, expectedContent) => {
    const result = resolveArchiveContent(archive, new URL(urlStr));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(expectedStatus);
    expect(decode(result!.content)).toBe(expectedContent);
  });

  it('returns JSON 404 fallback when archive has no 404.html', () => {
    const result = resolveArchiveContent(archiveNo404, new URL('polkadot://app.dot/missing.css'));
    expect(result).not.toBeNull();
    expect(result?.status).toBe(404);
    expect(result?.content).toBe(JSON.stringify({ message: '404: Not found' }));
  });

  it('returns null for hostname mismatch', () => {
    const result = resolveArchiveContent(archive, new URL('polkadot://other.dot/'));
    expect(result).toBeNull();
  });

  it('decodes URL-encoded path', () => {
    const arcWithSpace = makeArchive({ 'foo bar.txt': 'hello' });
    const result = resolveArchiveContent(arcWithSpace, new URL('polkadot://app.dot/foo%20bar.txt'));
    expect(result?.status).toBe(200);
    expect(decode(result!.content)).toBe('hello');
  });

  it('strips leading slash for double-slash URLs', () => {
    const result = resolveArchiveContent(archive, new URL('polkadot://app.dot//double-slash'));
    // After stripping first '/', path is '/double-slash', decode → 'double-slash'
    // Not in archive, has no extension → falls back to index.html
    expect(result).not.toBeNull();
    expect(result?.status).toBe(200);
  });
});

describe('isAllowedHostNavigation', () => {
  const protocol = 'polkadot';

  it.each([
    ['polkadot://app.dot/', true],
    ['polkadot://anything', true],
    ['http://localhost:5173/', true],
    ['http://localhost/', true],
    ['https://app.dot/', true],
    ['https://app.dot', true], // no trailing slash — regex \/|$
    ['https://sub.dot/', true], // sub.dot matches [^/]+\.dot
    ['https://something.dot.evil.com/', false], // .dot. mid-segment doesn't qualify
    ['https://evil.com/.dot', false], // .dot not at end of hostname
    ['https://example.com/', false],
    ['file:///etc/passwd', false],
    ['javascript:alert(1)', false],
    ['', false],
  ] as const)('isAllowedHostNavigation(%j) → %s', (url, expected) => {
    expect(isAllowedHostNavigation(url, protocol)).toBe(expected);
  });
});

describe('isExternalUrlAllowed', () => {
  it.each([
    ['https://example.com/', { allowed: true, href: 'https://example.com/' }],
    ['mailto:hello@example.com', { allowed: true, href: 'mailto:hello@example.com' }],
    ['tel:+15551234567', { allowed: true, href: 'tel:+15551234567' }],
    ['sms:+15551234567', { allowed: true, href: 'sms:+15551234567' }],
    // http is deliberately excluded — web links open over TLS only.
    ['http://example.com/', { allowed: false }],
    ['http://localhost:8080/secret', { allowed: false }],
    ['file:///etc/passwd', { allowed: false }],
    ['javascript:alert(1)', { allowed: false }],
    ['polkadot://app.dot/', { allowed: false }],
    ['data:text/html,<script>', { allowed: false }],
    ['not a url', { allowed: false }],
    ['', { allowed: false }],
  ] as const)('isExternalUrlAllowed(%j) → %j', (url, expected) => {
    expect(isExternalUrlAllowed(url)).toEqual(expected);
  });
});

describe('resolveSandboxWillNavigate', () => {
  const protocol = 'polkadot';

  it.each([
    ['polkadot://app.dot/page', { action: 'allow' }],
    ['http://localhost:5173/', { action: 'allow' }],
    ['https://example.com/', { action: 'deny', openExternalHref: 'https://example.com/' }],
    ['mailto:hello@example.com', { action: 'deny', openExternalHref: 'mailto:hello@example.com' }],
    ['http://example.com/', { action: 'deny' }],
    ['javascript:alert(1)', { action: 'deny' }],
  ] as const)('resolveSandboxWillNavigate(%j) → %j', (url, expected) => {
    expect(resolveSandboxWillNavigate(url, protocol)).toEqual(expected);
  });
});

describe('sanitizeWebPreferences', () => {
  it('removes dangerous keys, sets contextIsolation/sandbox/preload', () => {
    const prefs: SandboxPrefsFixture = {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      sandbox: false,
    };

    sanitizeWebPreferences(prefs, '/path/to/preload.js');

    expect('nodeIntegration' in prefs).toBe(false);
    expect('nodeIntegrationInWorker' in prefs).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.preload).toBe('/path/to/preload.js');
  });

  it('handles empty prefs without error', () => {
    const prefs: SandboxPrefsFixture = {};

    sanitizeWebPreferences(prefs, '/path/to/preload.js');

    expect('nodeIntegration' in prefs).toBe(false);
    expect('nodeIntegrationInWorker' in prefs).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.preload).toBe('/path/to/preload.js');
  });
});

describe('mapElectronPermission', () => {
  const cases: [ElectronSandboxPermissions, string[]][] = [
    ['geolocation', ['Location']],
    ['midi', []],
    ['notifications', []],
    ['fullscreen', []],
    ['unknown', []],
    ['fileSystem', []],
  ];
  it.each(cases)('mapElectronPermission(%j) → %j', (input, expected) => {
    expect(mapElectronPermission(input)).toEqual(expected);
  });

  describe('media maps to the concrete device permissions it requests', () => {
    it('video-only requires Camera only', () => {
      expect(mapElectronPermission('media', ['video'])).toEqual(['Camera']);
    });

    it('audio-only requires Microphone only (a Camera grant must not authorize the mic)', () => {
      expect(mapElectronPermission('media', ['audio'])).toEqual(['Microphone']);
    });

    it('audio+video requires both Camera and Microphone', () => {
      expect(mapElectronPermission('media', ['video', 'audio'])).toEqual(['Camera', 'Microphone']);
    });

    it('requires both when mediaTypes is absent or empty (fail-closed)', () => {
      expect(mapElectronPermission('media')).toEqual(['Camera', 'Microphone']);
      expect(mapElectronPermission('media', [])).toEqual(['Camera', 'Microphone']);
    });
  });
});
