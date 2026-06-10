import { produce } from 'immer';
import { interval, map, switchMap, throttle } from 'rxjs';
import * as v from 'valibot';

import { createQueryResource, createStreamResource } from '@/shared/resource';
import { minBigInt } from '@/shared/utils';
import { chainRegistry } from '../api/registry';
import { type Chain, type GenesisHash } from '../chain/types';

import { block } from './schemas';
import { type Block } from './types';

export const finalizedBlockResource = createStreamResource<Chain>({
  key: chain => chain.genesisHash,
})
  .subscribe<Block>(chain => {
    return chainRegistry.api$(chain).pipe(
      switchMap(({ client }) => client.finalizedBlock$),
      // finalized blocks arrive as batch
      throttle(() => interval(100)),
      map(b => v.parse(block, b)),
    );
  })
  .cache<Record<GenesisHash, Block>>({
    initial: {},
    map(cache, block, chain) {
      return produce(cache, draft => {
        draft[chain.genesisHash] = block;
      });
    },
  })
  .build();

export const bestBlockResource = createStreamResource<Chain>({
  key: chain => chain.genesisHash,
})
  .subscribe<Block>(chain => {
    return chainRegistry.api$(chain).pipe(
      switchMap(({ client }) => client.bestBlocks$),
      map(b => v.parse(block, b.at(0))),
    );
  })
  .cache<Record<GenesisHash, Block>>({
    initial: {},
    map(cache, block, chain) {
      return produce(cache, draft => {
        draft[chain.genesisHash] = block;
      });
    },
  })
  .build();

export const blockTimeResource = createQueryResource<Chain>({
  key: chain => chain.genesisHash,
})
  .request<bigint>(chain => {
    return chainRegistry.requestApi(chain, ({ staticApi }) => {
      // Block time is read across heterogeneous chains (relay `Babe`, parachain
      // `Aura`, …) — no single descriptor covers all — so the runtime-unsafe
      // constants snapshot is read behind a local optional shape (no descriptor).
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- untyped constants snapshot; fields are best-effort optionals
      const constants = staticApi.constants as {
        Babe?: { ExpectedBlockTime?: bigint };
        Aura?: { SlotDuration?: bigint };
        Timestamp?: { MinimumPeriod?: bigint | null };
        ParachainSystem?: unknown;
      };

      const ONE_DAY = BigInt(24 * 60 * 60 * 1000);

      const blockTime = constants.Babe?.ExpectedBlockTime ?? constants.Aura?.SlotDuration ?? null;
      if (blockTime) {
        return minBigInt(ONE_DAY, blockTime);
      }

      // Some chains incorrectly set MinimumPeriod (e.g. 0 or 2); validate against
      // a low threshold before trusting it.
      const THRESHOLD = 1000n / 2n;
      const minimumPeriod = constants.Timestamp?.MinimumPeriod;
      if (minimumPeriod != null && minimumPeriod >= THRESHOLD) {
        return minBigInt(ONE_DAY, minimumPeriod * 2n);
      }

      // usual blocktime for relaychain
      const DEFAULT_TIME = 6000n;

      // default guess for a parachain (usually 2x the default blocktime)
      if (constants.ParachainSystem != null) {
        return minBigInt(ONE_DAY, DEFAULT_TIME * 2n);
      }

      // default guess for others
      return minBigInt(ONE_DAY, DEFAULT_TIME);
    });
  })
  .retry({ delay: 500, count: 5 })
  .cache<Record<GenesisHash, bigint>>({
    initial: {},
    staleAfter: Number.POSITIVE_INFINITY,
    map(cache, block, chain) {
      return {
        ...cache,
        [chain.genesisHash]: block,
      };
    },
  })
  .build();
