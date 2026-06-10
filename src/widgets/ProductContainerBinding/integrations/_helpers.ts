import { toastError } from '@novasamatech/tr-ui';

import { type RateLimiterKind, RATE_LIMITED_MESSAGE } from '@/shared/rateLimiter';
import { createAsyncTaskPool } from '@/shared/utils';

type Translate = (id: string, values?: Record<string, string | number>) => string;

function rateLimitToastKey(productId: string, limiterType: RateLimiterKind) {
  return `${productId}:${limiterType}`;
}

export function showRateLimitToast(productId: string, productName: string, limiterType: RateLimiterKind, t: Translate) {
  const key = rateLimitToastKey(productId, limiterType);
  const limiterLabel = t(`widget.rateLimiter.types.${limiterType}`);
  toastError({
    id: `rate-limit:${key}`,
    title: productName,
    description: t('widget.rateLimiter.description', { limiterType: limiterLabel }),
  });
}

export function createOnRateLimited(productId: string, getProductName: () => string, limiterType: RateLimiterKind, t: Translate) {
  return () => {
    const productName = getProductName();
    console.error(RATE_LIMITED_MESSAGE, { productId, productName, limiterType });
    showRateLimitToast(productId, productName, limiterType, t);
  };
}

// Sequential papp SSO interactions: one approval modal at a time. Subsequent
// requests queue behind the active one. Callers pass an AbortSignal so an
// unmount during a hung interaction rejects every queued/active task and any
// pending pool.call promise resolves cleanly.
export const pappSsoQueue = createAsyncTaskPool({ poolSize: 1, retryCount: 0, retryDelay: 0 });
