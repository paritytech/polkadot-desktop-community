import { encodeAddress } from '@polkadot/util-crypto';

import { extractDomain, truncateDomain } from '@/shared/utils';

import { isLocalhostUrl, parseLocalhostUrl } from './localhost';
import { type DotNsUrl } from './types';

// Accept bare label (`hackm3`) or full base name (`hackm3.dot`); always return
// `<id>.dot` lowercase.
function baseNameOf(input: string): string {
  const trimmed = input.trim().toLowerCase();
  return trimmed.endsWith('.dot') ? trimmed : `${trimmed}.dot`;
}

// Product-identity equality: stored ids may be raw webview identifiers (any
// casing, `.dot` optional) while committed rows hold the normalized base name —
// two ids denote the same product iff they normalize to the same base name.
function isSameBaseName(a: string, b: string): boolean {
  return baseNameOf(a) === baseNameOf(b);
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

function isSafeDotNsIdentifier(id: string): boolean {
  const lower = id.toLowerCase();
  if (lower === 'localhost' || /^localhost:\d{1,5}$/.test(lower)) return true;

  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+dot$/.test(lower);
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

function asSafeNavigationTarget(url: DotNsUrl | null): DotNsUrl | null {
  if (!url) return null;
  if (!isSafeDotNsIdentifier(url.identifier)) return null;
  if (!isSafeDotNsPathname(url.pathname)) return null;

  return url;
}

function stripLiSuffix(domain: string) {
  return domain.replace(/\.dot\.li$/, '.dot');
}

function isDotDomain(domain: string) {
  return domain.endsWith('.dot') || domain.endsWith('.dot.li');
}

// Human-facing display name: strip the trailing `.dot` so launchers show
// `hackm3` rather than `hackm3.dot`. Pure transform on a dotNS name string.
function toDisplayName(name: string): string {
  return name.replace(/\.dot$/, '');
}

// Truncated label for compact surfaces (dashboard tiles, shortcuts). A full
// `.dot` name is kept as-is; otherwise the domain is extracted first, then
// truncated. The length cap is the caller's presentation choice.
function toShortLabel(name: string, maxLen = 10): string {
  const domain = isDotDomain(name) ? name : extractDomain(name);
  return truncateDomain(domain, maxLen);
}

function isProductIdentifier(id: string) {
  return isDotDomain(id) || isLocalhostUrl(id);
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

function getDotUrlFromParsed(parsed: URL): DotNsUrl | null {
  if (!isDotDomain(parsed.hostname)) return null;

  return {
    identifier: stripLiSuffix(parsed.hostname),
    pathname: parsed.pathname.replace(/^\//, '') + parsed.search + parsed.hash,
  };
}

function parseDotNsDomain(url: string): DotNsUrl | null {
  const normalized = url.trim();
  if (!normalized) return null;

  const parsed = normalized.startsWith('polkadot://') ? parseUrl(normalized) : parseUrlWithFallbackProtocol(normalized);
  if (!parsed) return asSafeNavigationTarget(parseLocalhostUrl(normalized));

  const dotUrl = getDotUrlFromParsed(parsed);
  if (dotUrl) return asSafeNavigationTarget(dotUrl);
  return asSafeNavigationTarget(parseLocalhostUrl(normalized));
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
  subnameOf,
  generateProductBase,
  isDotDomain,
  isProductIdentifier,
  parseDotNsDomain,
  toDisplayName,
  toShortLabel,
  reviveOriginAccount,
};
