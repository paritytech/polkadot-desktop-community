/**
 * Compile-time feature flags. Each flag must default to a safe value
 * (typically `false`) and be flipped only after the feature is ready
 * for production exposure.
 */

export const FEATURE_FLAGS = {
  /**
   * Multi-device sync over WebRTC (PB-?, parent: PANS-2324).
   * Flipped to `true` for the Desktop/Android interop bringup. Revert
   * to `false` if we need to ship a build without sync side-effects on
   * the statement-store (e.g. allowance budget concerns).
   */
  deviceSync: true,
} as const;
