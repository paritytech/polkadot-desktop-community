import { encodeAddress } from '@polkadot/util-crypto';

import { extractDomain, truncateDomain } from '@/shared/utils';

import { type DotNsUrl } from './types';

export function isLocalhostUrl(url: string) {
  return url.startsWith('http://localhost') || url.startsWith('localhost');
}

export function normalizeLocalhostUrl(url: string) {
  return url.startsWith('localhost') ? `http://${url}` : url;
}

export function parseLocalhostUrl(url: string): DotNsUrl | null {
  try {
    const parsed = new URL(normalizeLocalhostUrl(url));

    if (parsed.hostname !== 'localhost') return null;

    return {
      identifier: parsed.host,
      pathname: parsed.pathname.replace(/^\//, '') + parsed.search + parsed.hash,
    };
  } catch {
    return null;
  }
}

// Accept bare label (`hackm3`) or full base name (`hackm3.paseo`); always return
// `<id><tld>` lowercase.
function baseNameOf(input: string, tld: string): string {
  const trimmed = input.trim().toLowerCase();
  return trimmed.endsWith(tld) ? trimmed : `${trimmed}${tld}`;
}

// Product-identity equality: stored ids may be raw webview identifiers (any
// casing, TLD optional) while committed rows hold the normalized base name —
// two ids denote the same product iff they normalize to the same base name.
function isSameBaseName(a: string, b: string, tld: string): boolean {
  return baseNameOf(a, tld) === baseNameOf(b, tld);
}

// The label just above the TLD — `caller` for `app.caller.dot` — which is how the
// TrUAPI core names a product across its executables. Mirrors `ProductId::bare_label`
// rather than taking the active TLD: an id from another network still names its own
// product, never its TLD, and an id with no TLD is its own label.
function labelOf(input: string): string {
  const parts = input.trim().toLowerCase().split('.');

  return parts.length > 1 ? (parts.at(-2) ?? input) : input;
}

// dotNS subname grammar: a `<sub>.<base>` name. The sub is opaque here
// (callers pass an executable kind, but dotNS doesn't model that).
function subnameOf(baseName: string, sub: string): string {
  return `${sub}.${baseName}`;
}

function normalizeName(name: string): string {
  return name.split('/').map(encodeURIComponent).join('/');
}

// The synthetic `polkadot://` origin the renderer serves archive files under —
// the inverse of `parseDotNsDomain`'s `polkadot://` parsing.
function generateProductBase(name: string): string {
  return `polkadot://${normalizeName(name)}`;
}

// A localhost identifier is decided without the suffix — it names no dotNS
// registry — which is why `tld` is nullable here: with no settled suffix nothing
// is a dotNS name, but a localhost product still is itself.
function isSafeDotNsIdentifier(id: string, tld: Nullable<string>): boolean {
  const lower = id.toLowerCase();
  if (lower === 'localhost' || /^localhost:\d{1,5}$/.test(lower)) return true;
  if (!tld) return false;

  // `tld` is validated as a single DNS label at the chain boundary
  // (`networkTldSchema`), so interpolating it here needs no escaping.
  return new RegExp(`^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+${tld.slice(1)}$`).test(lower);
}

function hasAsciiControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const unit = s.charCodeAt(i);
    if (unit <= 0x1f || unit === 0x7f) return true;
  }

  return false;
}

function isSafeDotNsPathname(pathname: string): boolean {
  if (pathname.length > 8_000) return false;
  if (hasAsciiControlChar(pathname)) return false;
  if (/[\s<>"\\{}[\]^`|()]/.test(pathname)) return false;
  if (/%(?![0-9A-Fa-f]{2})/i.test(pathname)) return false;

  return true;
}

function asSafeNavigationTarget(url: DotNsUrl | null, tld: Nullable<string>): DotNsUrl | null {
  if (!url) return null;
  if (!isSafeDotNsIdentifier(url.identifier, tld)) return null;
  if (!isSafeDotNsPathname(url.pathname)) return null;

  return url;
}

// The HTTP gateway serves a name at `<label><tld>.li` (`hackm3.dot.li`,
// `hackm3.paseo.li`); collapse it back onto the on-chain name.
function stripLiSuffix(domain: string, tld: string) {
  return domain.endsWith(`${tld}.li`) ? domain.slice(0, -3) : domain;
}

function isDotDomain(domain: string, tld: Nullable<string>) {
  if (!tld) return false;

  return domain.endsWith(tld) || domain.endsWith(`${tld}.li`);
}

// Human-facing display name: strip the trailing TLD so launchers show `hackm3`
// rather than `hackm3.paseo`. Pure transform on a dotNS name string.
function toDisplayName(name: string, tld: string): string {
  return name.endsWith(tld) ? name.slice(0, -tld.length) : name;
}

// Truncated label for compact surfaces (dashboard tiles, shortcuts). A full
// dotNS name is kept as-is; otherwise the domain is extracted first, then
// truncated. The length cap is the caller's presentation choice.
function toShortLabel(name: string, tld: string, maxLen = 10): string {
  const domain = isDotDomain(name, tld) ? name : extractDomain(name);
  return truncateDomain(domain, maxLen);
}

function isProductIdentifier(id: string, tld: string) {
  return isDotDomain(id, tld) || isLocalhostUrl(id);
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function parseUrlWithFallbackProtocol(url: string): URL | null {
  const parsed = parseUrl(url);
  if (parsed) return parsed;
  return parseUrl(`https://${url}`);
}

function getDotUrlFromParsed(parsed: URL, tld: Nullable<string>): DotNsUrl | null {
  // `URL` lowercases the host only for special schemes (`https:`), not `polkadot:`.
  // dotNS names are case-insensitive, and the core normalizes every product id to
  // lowercase — an identifier born in another case would key host state apart.
  const host = parsed.hostname.toLowerCase();
  if (!tld || !isDotDomain(host, tld)) return null;

  return {
    identifier: stripLiSuffix(host, tld),
    pathname: parsed.pathname.replace(/^\//, '') + parsed.search + parsed.hash,
  };
}

function parseDotNsDomain(url: string, tld: Nullable<string>): DotNsUrl | null {
  const normalized = url.trim();
  if (!normalized) return null;

  const parsed = normalized.startsWith('polkadot://') ? parseUrl(normalized) : parseUrlWithFallbackProtocol(normalized);
  if (!parsed) return asSafeNavigationTarget(parseLocalhostUrl(normalized), tld);

  const dotUrl = getDotUrlFromParsed(parsed, tld);
  if (dotUrl) return asSafeNavigationTarget(dotUrl, tld);
  return asSafeNavigationTarget(parseLocalhostUrl(normalized), tld);
}

// Revive system account used as the dry-run origin for read-only `ReviveApi.call`
// queries.
function reviveOriginAccount(): string {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode('modlpy/reviv'), 0);
  return encodeAddress(bytes, 42);
}

export const dotNsService = {
  baseNameOf,
  isSameBaseName,
  labelOf,
  subnameOf,
  generateProductBase,
  isDotDomain,
  isProductIdentifier,
  parseDotNsDomain,
  toDisplayName,
  toShortLabel,
  reviveOriginAccount,
};
