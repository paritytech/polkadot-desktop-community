const SUPPORTED_BUILD_SOURCES = ['github', 's3'] as const;

export function checkAutoUpdateSupported(): boolean {
  const buildSource = process.env['BUILD_SOURCE'];

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !!buildSource && SUPPORTED_BUILD_SOURCES.includes(buildSource as (typeof SUPPORTED_BUILD_SOURCES)[number]);
}

/**
 * Get OS type. Uses process.platform in Node.js (Electron main),
 * getOperatingSystem (navigator) in browser and Electron renderer.
 */
export const getOsType = (): string => {
  if (typeof process !== 'undefined' && process.platform) {
    switch (process.platform) {
      case 'darwin':
        return 'macOS';
      case 'win32':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return 'Unknown';
    }
  }

  return process.release?.name ?? 'Unknown';
};
