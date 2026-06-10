// Polkadot SS58 addresses are base58-encoded 32-byte payloads — typical
// printed length is 47-49 chars, and substrate (prefix 42) addresses all
// start with `5`. This is good enough to detect a "name" that's really just
// the accountId and format it as `5H1e…0bMm` instead of showing the full
// 48-char string in the chat list / header.
const SS58_LIKE_RE = /^[1-9A-HJ-NP-Za-km-z]{46,49}$/;

function isSs58Like(value: string): boolean {
  return SS58_LIKE_RE.test(value);
}

export function formatPeerName(name: string | undefined | null, accountId?: string): string {
  const raw = name && name.trim().length > 0 ? name : (accountId ?? '');
  if (!raw) return '';
  if (!isSs58Like(raw)) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}
