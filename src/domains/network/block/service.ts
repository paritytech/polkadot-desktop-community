import { type BlockHeight } from './types';

const getBlockTimestamp = ({
  neededBlock,
  currentBlock,
  blockTime,
}: {
  neededBlock: BlockHeight;
  currentBlock: BlockHeight;
  blockTime: bigint;
}): number => {
  return Date.now() + (neededBlock - currentBlock) * Number(blockTime);
};

export const blockService = {
  getBlockTimestamp,
};
