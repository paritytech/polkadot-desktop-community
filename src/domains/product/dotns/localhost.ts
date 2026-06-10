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
