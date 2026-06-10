import * as path from 'node:path';

// @ts-expect-error no types
import { lookup as mimeLookup } from 'mime-types';

import { type ExecutableKind, type ProductArchive } from '@/domains/product';

const SANDBOX_PREFIX = 'sandbox-';

// Webview-backed executables map to a partition SLOT. The worker executable is
// headless (no partition of its own); if it ever reaches the builder it shares
// the 'app' slot — matching permissionsService.modalityForKind(worker) === 'app'.
// If another executable becomes webview-backed, add its slot here.
const SANDBOX_SLOTS = ['app', 'widget'] as const;
type SandboxSlot = (typeof SANDBOX_SLOTS)[number];

function partitionSlot(executable: ExecutableKind): SandboxSlot {
  return executable === 'widget' ? 'widget' : 'app';
}

// Partition format: `sandbox-<slot>-<encodeURIComponent(productId)>`.
// The slot is a FIXED leading token — always 'app' or 'widget', neither of which
// contains '-'. The productId is percent-encoded and placed after the FIRST '-',
// so it can never be mistaken for the slot regardless of the characters it holds
// (the old `sandbox-<id>[--widget]` suffix scheme aliased an app product whose id
// ended in `--widget` onto another product's widget partition; the slot prefix
// removes that ambiguity entirely). The sandbox owns this format; the renderer
// mirrors it in Webview.tsx (which cannot import main/ code), pinned by the
// cross-target drift test in Webview.test.tsx. Keep the two in sync.
export function buildSandboxPartition(productId: string, executable: ExecutableKind): string {
  return `${SANDBOX_PREFIX}${partitionSlot(executable)}-${encodeURIComponent(productId)}`;
}

// Partitions for a product that have actually been wired up this run.
// session.fromPartition lazily CREATES a session, so clearing must not touch
// partitions the product never opened (e.g. the widget partition of an app-only
// product) — non-persist sessions hold no data outside this run anyway.
export function listClearablePartitions(productId: string, configuredPartitions: ReadonlySet<string>): string[] {
  return SANDBOX_SLOTS.map(slot => buildSandboxPartition(productId, slot)).filter(partition =>
    configuredPartitions.has(partition),
  );
}

export function parseSandboxPartition(partition: string): { productId: string; executable: ExecutableKind } | null {
  if (!partition.startsWith(SANDBOX_PREFIX)) return null;

  const rest = partition.slice(SANDBOX_PREFIX.length);
  const delimiter = rest.indexOf('-');
  if (delimiter === -1) return null;

  const slot = rest.slice(0, delimiter);
  if (slot !== 'app' && slot !== 'widget') return null;

  try {
    return { productId: decodeURIComponent(rest.slice(delimiter + 1)), executable: slot };
  } catch {
    return null;
  }
}

export function validateArchiveDomain(domain: unknown): { ok: true; domain: string } | { ok: false; error: string } {
  if (!domain || typeof domain !== 'string') {
    return { ok: false, error: 'Invalid domain' };
  }
  if (/[/\\:]/.test(domain) || domain.includes('\0')) {
    return { ok: false, error: 'Invalid domain characters' };
  }
  return { ok: true, domain };
}

export function validateArchiveFilePath(filePath: string): { ok: true } | { ok: false; error: string } {
  if (filePath === '') {
    return { ok: false, error: 'Invalid file path: empty' };
  }
  if (filePath.includes('../') || filePath.startsWith('/') || filePath.includes('\\') || filePath.includes('\0')) {
    return { ok: false, error: `Invalid file path: ${filePath}` };
  }
  return { ok: true };
}

// The contenthash is used as an on-disk directory name in the archive store, so
// it must never carry path separators, parent-dir refs, or null bytes. In this
// app a contenthash is always a `0x`-prefixed hex string; this is defense-in-depth
// (parallel to validateArchiveDomain) against a compromised shell renderer.
export function validateContenthash(value: unknown): { ok: true; contenthash: string } | { ok: false; error: string } {
  if (!value || typeof value !== 'string') {
    return { ok: false, error: 'Invalid contenthash' };
  }
  if (/[/\\:]/.test(value) || value.includes('..') || value.includes('\0')) {
    return { ok: false, error: 'Invalid contenthash characters' };
  }
  return { ok: true, contenthash: value };
}

/**
 * Check if a hostname matches any of the allowed domains (exact or subdomain).
 * `matchesDomain('sub.relay.example.com', ['relay.example.com'])` → true
 * `matchesDomain('attacker-relay.example.com', ['relay.example.com'])` → false
 */
export function matchesDomain(hostname: string, allowedDomains: string[]): boolean {
  if (!hostname || allowedDomains.length === 0) return false;
  return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Parse a comma-separated list of hostnames from an env variable into the format
 * `matchesDomain` consumes. Empty / unset → empty allowlist, which means every
 * matching request (TURN/STUN, IPFS gateway, …) from a product webview goes
 * through the renderer-side permission flow (fail-closed). Set the corresponding
 * env variable only when you operate a known host that products should reach
 * without prompting the user — see PUBLISHING.md.
 */
export function parseHostAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

/**
 * Returns the localhost port a product is loaded from, or null if it isn't a
 * localhost product. Used to scope `http://localhost` network access to the
 * product's own port — preventing lateral access to other local services.
 *
 * The webview partition decodes to a bare identifier (e.g. `localhost:5173`,
 * `foo.dot`) rather than a URL, so prefix `http://` before parsing. The
 * legacy `http://localhost…` URL form is accepted too.
 */
export function parseProductLocalhostPort(productId: string | null): string | null {
  if (!productId) return null;
  const candidate = productId.startsWith('http://') ? productId : `http://${productId}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname !== 'localhost') return null;
    return parsed.port;
  } catch {
    return null;
  }
}

export type NetworkDecision = 'fetch-direct' | 'check-permission';

export function evaluateNetworkRequest(args: {
  scheme: 'http' | 'https' | 'ws' | 'wss';
  method: string;
  url: URL;
  ipfsAllowlist: string[];
  relayAllowlist: string[];
  /**
   * Port of the product's own origin when it is itself loaded from `http://localhost:<port>`,
   * `null` otherwise. The empty string represents the default port (no `:` in the URL).
   * `http://localhost` requests are only fetched directly when the request port matches.
   */
  productLocalhostPort: string | null;
}): NetworkDecision {
  const { scheme, method, url, ipfsAllowlist, relayAllowlist, productLocalhostPort } = args;
  const hostname = url.hostname;

  switch (scheme) {
    case 'https': {
      // Temporary hack: allow GET requests to IPFS gateway until smoldot bitswap is ready
      const isIpfsRequest = method === 'GET' && matchesDomain(hostname, ipfsAllowlist);
      // Temporary hack: Allow TURN/STUN relay server requests for WebRTC connectivity
      const isRelayRequest = matchesDomain(hostname, relayAllowlist);
      // Temporary hack: Allow Sentry.io requests (QUIRK: substring match, not domain match)
      const isSentry = hostname.includes('sentry.io');

      if (isIpfsRequest || isRelayRequest || isSentry) return 'fetch-direct';
      return 'check-permission';
    }
    case 'http':
    case 'ws': {
      if (hostname !== 'localhost') return 'check-permission';
      if (productLocalhostPort === null) return 'check-permission';
      return url.port === productLocalhostPort ? 'fetch-direct' : 'check-permission';
    }
    case 'wss': {
      // QUIRK: only ws://localhost is whitelisted, NOT wss://localhost — intentional behavior pin
      return 'check-permission';
    }
  }
}

export type ArchiveLookupResult =
  | { status: 200; mimeType: string; content: Uint8Array | string }
  | { status: 404; mimeType: string; content: Uint8Array | string };

function getMimeType(filePath: string): string {
  const result: string | false = mimeLookup(filePath);
  return result || 'application/octet-stream';
}

function hasExtension(filePath: string): boolean {
  return path.extname(filePath).length > 0;
}

export function resolveArchiveContent(archive: ProductArchive, url: URL): ArchiveLookupResult | null {
  if (url.hostname !== archive.domain) return null;

  const pathname = url.pathname;
  const originalPath = pathname.startsWith('/') ? decodeURIComponent(pathname.substring(1)) : pathname;
  let cleanPath = originalPath;
  let content: Uint8Array | string | undefined = archive.files[cleanPath];

  if (!content && !hasExtension(originalPath)) {
    cleanPath = path.join(originalPath, 'index.html');
    content = archive.files[cleanPath];

    if (!content) {
      cleanPath = 'index.html';
      content = archive.files[cleanPath];
    }
  }

  if (content) {
    return { status: 200, mimeType: getMimeType(cleanPath), content };
  }

  // Not found — return 404
  const html404 = '404.html';
  const possible404Page = archive.files[html404];

  if (possible404Page) {
    return { status: 404, mimeType: getMimeType(html404), content: possible404Page };
  }

  return { status: 404, mimeType: getMimeType('404.json'), content: JSON.stringify({ message: '404: Not found' }) };
}

export function isAllowedHostNavigation(url: string, electronProtocol: string): boolean {
  if (!url) return false;
  if (url.startsWith(`${electronProtocol}://`)) return true;
  if (url.startsWith('http://localhost')) return true;
  if (/^https?:\/\/[^/]+\.dot(\/|$)/.test(url)) return true;
  return false;
}

// https plus schemes that only open a system app prefilled (mail / dialer / messages) — the
// user still confirms any action. http is deliberately excluded: web links open over TLS only.
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:', 'tel:', 'sms:']);

export function isExternalUrlAllowed(url: string): { allowed: boolean; href?: string } {
  if (!url) return { allowed: false };
  try {
    const parsed = new URL(url);
    if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return { allowed: true, href: parsed.href };
    }
    return { allowed: false };
  } catch {
    return { allowed: false };
  }
}

export type SandboxWillNavigateDecision = { action: 'allow' } | { action: 'deny'; openExternalHref?: string };

/**
 * Product webviews may only navigate in-product. Same-tab clicks on external links
 * (web over https, or mailto/tel/sms) must open in the matching system app
 * (window.open / target=_blank already use setWindowOpenHandler).
 */
export function resolveSandboxWillNavigate(url: string, electronProtocol: string): SandboxWillNavigateDecision {
  if (isAllowedHostNavigation(url, electronProtocol)) {
    return { action: 'allow' };
  }

  const external = isExternalUrlAllowed(url);
  if (external.allowed) {
    return { action: 'deny', openExternalHref: external.href };
  }

  return { action: 'deny' };
}

// Minimal shape used by sanitizeWebPreferences; WebPreferences is a superset of this.
type SandboxPrefs = {
  nodeIntegration?: boolean;
  nodeIntegrationInWorker?: boolean;
  preload?: string;
  contextIsolation?: boolean;
  sandbox?: boolean;
};

export function sanitizeWebPreferences(prefs: SandboxPrefs, preloadPath: string): void {
  delete prefs.nodeIntegration;
  delete prefs.nodeIntegrationInWorker;
  prefs.preload = preloadPath;
  prefs.contextIsolation = true;
  prefs.sandbox = true;
}

export type ElectronSandboxPermissions =
  | 'clipboard-read'
  | 'clipboard-sanitized-write'
  | 'display-capture'
  | 'fullscreen'
  | 'geolocation'
  | 'idle-detection'
  | 'media'
  | 'mediaKeySystem'
  | 'midi'
  | 'midiSysex'
  | 'notifications'
  | 'pointerLock'
  | 'keyboardLock'
  | 'openExternal'
  | 'speaker-selection'
  | 'storage-access'
  | 'top-level-storage-access'
  | 'window-management'
  | 'unknown'
  | 'fileSystem';

// DevicePermissionType is re-declared locally to avoid a runtime import from the renderer
export type DevicePermissionType = 'Camera' | 'Microphone' | 'Location';

// Electron reports camera and microphone capture under a SINGLE `media` permission;
// the concrete devices are in `mediaTypes`. The renderer stores Camera and
// Microphone as independent per-modality decisions, so a `media` request maps to
// the SET of device permissions it actually needs — `getUserMedia({audio,video})`
// requires BOTH. Returning the full set lets the caller gate on every one (grant
// only if all are granted), so a Camera grant can never silently authorize the mic.
// When `mediaTypes` is absent/empty (shouldn't happen for a real media request) we
// require both — fail-closed.
export function mapElectronPermission(
  p: ElectronSandboxPermissions,
  mediaTypes?: readonly ('video' | 'audio')[],
): DevicePermissionType[] {
  switch (p) {
    case 'media': {
      const types = mediaTypes && mediaTypes.length > 0 ? mediaTypes : (['video', 'audio'] as const);
      const names: DevicePermissionType[] = [];
      if (types.includes('video')) names.push('Camera');
      if (types.includes('audio')) names.push('Microphone');

      return names;
    }
    case 'geolocation':
      return ['Location'];
    default:
      return [];
  }
}
