import { type HexString } from '@/shared/types';
import { type ExecutableKind } from '../manifest/constants';

export type ExecutableCacheStatus = 'preparing' | 'ready' | 'failed';

export type ExecutableCacheEntry = {
  baseName: string;
  kind: ExecutableKind;
  domain: string;
  contenthash: HexString;
  status: ExecutableCacheStatus;
  sizeBytes: number;
  updatedAt: number;
};
