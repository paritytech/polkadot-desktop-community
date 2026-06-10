const DISMISSED_VERSION_KEY = 'dismissed_update_version';

export function getProgressPercent(data: unknown): number {
  if (data && typeof data === 'object' && 'percent' in data) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- IPC data is unknown
    const value = (data as Record<string, unknown>)['percent'];
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

export function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- IPC data is unknown
    const value = (data as Record<string, unknown>)['message'];
    return value != null ? String(value) : fallback;
  }
  return fallback;
}

export function getVersion(data: unknown): string | null {
  if (data && typeof data === 'object' && 'version' in data) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- IPC data is unknown
    const value = (data as Record<string, unknown>)['version'];
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export const readDismissedVersion = (): string | null => localStorage.getItem(DISMISSED_VERSION_KEY);

export const writeDismissedVersion = (version: string): void => {
  localStorage.setItem(DISMISSED_VERSION_KEY, version);
};
