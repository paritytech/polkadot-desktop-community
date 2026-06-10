import { type HexString } from '@/shared/types';
import { useLiveExecutableContenthash, usePersistedProductById } from '@/domains/product';

// Returns the live chain contenthash when it differs from the pinned worker
// contenthash; null otherwise. Worker is the practical signal — that's the
// long-running executable the user cares about updating.
export const useNewerVersionAvailable = (productId: string): { contenthash: HexString } | null => {
  const { data: record } = usePersistedProductById(productId);
  const worker = record?.executables.worker ?? null;
  const shouldCheck = record?.pinned === true && worker !== null;
  const { data: live } = useLiveExecutableContenthash(shouldCheck && record ? { product: record, kind: 'worker' } : null);

  if (!shouldCheck || !worker || !live) return null;
  if (live === worker.contenthash) return null;
  return { contenthash: live };
};
