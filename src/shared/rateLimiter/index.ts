import {
  type RateLimiter,
  type RateLimiterConfig,
  type RateLimiterStrategy,
  createRateLimiter,
} from '@novasamatech/host-container';

export type { RateLimiter, RateLimiterConfig };

export type RateLimiterKind =
  | 'rpc'
  | 'featureSupport'
  | 'navigation'
  | 'localStorageRead'
  | 'localStorageWrite'
  | 'pushNotification'
  | 'pushNotificationCancel'
  | 'permissions'
  | 'legacyAccounts'
  | 'identityAccount'
  | 'productAccounts'
  | 'alias'
  | 'entropy'
  | 'login'
  | 'preimage';

export const RATE_LIMITED_MESSAGE = 'Request rate limited';

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequestsPerInterval: 20,
  intervalMs: 1000,
  maxQueuedRequests: 100,
};

export type CreateDefaultWebviewRateLimiterOptions<Err> = Partial<RateLimiterConfig> & {
  strategy?: RateLimiterStrategy;
  onRateLimited?(): void;
  mapErr(message: string): Err;
};

export function createDefaultRateLimiter<Err>(options: CreateDefaultWebviewRateLimiterOptions<Err>): RateLimiter {
  return createRateLimiter({
    strategy: 'drop',
    ...DEFAULT_RATE_LIMITER_CONFIG,
    ...options,
    onDrop: () => {
      options?.onRateLimited?.();
      return options.mapErr(RATE_LIMITED_MESSAGE);
    },
  });
}
