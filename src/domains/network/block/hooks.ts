import { useMemo } from 'react';

import { useRead } from '@/shared/hooks';
import { type NullableMap } from '@/shared/types';
import { nonNullable, nullable } from '@/shared/utils';
import { type Chain } from '../chain/types';

import { bestBlockResource, blockTimeResource, finalizedBlockResource } from './resource';
import { blockService } from './service';
import { type BlockHeight } from './types';

export const useFinalizedBlock = (chain: Nullable<Chain>) => {
  return useRead(finalizedBlockResource, {
    params: nonNullable(chain) ? chain : null,
    defaultValue: null,
    map: (cache, chain) => cache[chain.genesisHash],
  });
};

export const useBestBlock = (chain: Nullable<Chain>) => {
  return useRead(bestBlockResource, {
    params: nonNullable(chain) ? chain : null,
    defaultValue: null,
    map: (cache, chain) => cache[chain.genesisHash],
  });
};

export const useBlockTime = (chain: Nullable<Chain>) => {
  return useRead(blockTimeResource, {
    params: nonNullable(chain) ? chain : null,
    defaultValue: null,
    map: (cache, chain) => cache[chain.genesisHash],
  });
};

export const useBlockTimestamp = ({ chain, blockHeight }: NullableMap<{ chain: Chain; blockHeight: BlockHeight }>) => {
  const { data: bestBlock, pending: pendingBestBlock } = useBestBlock(chain);
  const { data: blockTime, pending: pendingBlockTime } = useBlockTime(chain);

  const timestamp = useMemo(() => {
    if (nullable(bestBlock) || nullable(blockHeight) || nullable(blockTime)) return null;
    return blockService.getBlockTimestamp({ currentBlock: bestBlock.number, neededBlock: blockHeight, blockTime });
  }, [bestBlock, blockHeight, blockTime]);

  return { data: timestamp, pending: pendingBestBlock || pendingBlockTime };
};

export const useFinalizedBlockTimestamp = (chain: Nullable<Chain>) => {
  const { data: finalizedBlock, pending: pendingFinalizedBlock } = useFinalizedBlock(chain);
  const { data: blockTime, pending: pendingBlockTime } = useBlockTime(chain);

  const timestamp = useMemo(() => {
    if (nullable(finalizedBlock) || nullable(blockTime)) return null;
    return blockService.getBlockTimestamp({ currentBlock: finalizedBlock.number, neededBlock: finalizedBlock.number, blockTime });
  }, [finalizedBlock, blockTime]);

  return { data: timestamp, pending: pendingFinalizedBlock || pendingBlockTime };
};

export const useBestBlockTimestamp = (chain: Nullable<Chain>) => {
  const { data: bestBlock, pending: pendingBestBlock } = useBestBlock(chain);
  const { data: blockTime, pending: pendingBlockTime } = useBlockTime(chain);

  const timestamp = useMemo(() => {
    if (nullable(bestBlock) || nullable(blockTime)) return null;
    return blockService.getBlockTimestamp({ currentBlock: bestBlock.number, neededBlock: bestBlock.number, blockTime });
  }, [bestBlock, blockTime]);

  return { data: timestamp, pending: pendingBestBlock || pendingBlockTime };
};
