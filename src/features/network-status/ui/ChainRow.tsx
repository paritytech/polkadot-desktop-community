import { type FC, useId, useState } from 'react';

import { ChevronDownIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { type ChainHealth, type ChainStatus } from '@/domains/network';
import { HISTORY_SLOTS } from '../constants';
import { networkStatusService } from '../service';
import { type Duration, type StatusText } from '../types';

import { BlockStrip } from './BlockStrip';
import { ChainHealthMark } from './ChainHealthMark';

type Translate = ReturnType<typeof useTranslation>['t'];

type Props = {
  chain: ChainStatus;
  health: ChainHealth;
};

function translateDuration(t: Translate, { minutes, seconds }: Duration): string {
  return minutes === 0
    ? t('feature.networkStatus.duration.seconds', { seconds })
    : t('feature.networkStatus.duration.minutes', { minutes, seconds });
}

function translateStatus(t: Translate, text: StatusText): string {
  switch (text.kind) {
    case 'noInternet':
    case 'noEndpoint':
    case 'notInUse':
    case 'disconnected':
    case 'connecting':
    case 'notProducing':
      return t(`feature.networkStatus.status.${text.kind}`);
    case 'syncing':
      return text.percent === null
        ? t('feature.networkStatus.status.syncing')
        : t('feature.networkStatus.status.syncingShare', { percent: text.percent });
    case 'producing': {
      const word = t(text.behind ? 'feature.networkStatus.status.behind' : 'feature.networkStatus.status.connected');
      if (text.live === null) {
        return word;
      }

      return t('feature.networkStatus.status.live', {
        word,
        percent: text.live.percent,
        duration: translateDuration(t, text.live.block),
      });
    }
  }
}

export const ChainRow: FC<Props> = ({ chain, health }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const detailId = useId();

  const name = chain.role === null ? chain.name : t(`feature.networkStatus.role.${chain.role}`);
  const mark = networkStatusService.pickChainMark(health);
  const line = networkStatusService.describeChainStatus(health, chain.blockTimeMs);
  const setAside = mark.kind === 'unused' || mark.kind === 'unavailable';
  // No caption rather than "0 peers" until a sample lands: zero is a different claim.
  const peers =
    networkStatusService.isWatched(chain) && chain.peers !== null
      ? { count: chain.peers, text: t('feature.networkStatus.peers.count', { count: chain.peers }) }
      : null;
  const newest = chain.bars.at(-1);

  return (
    <div
      data-testid={TEST_IDS.networkChainRow}
      data-mark={mark.kind}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 border-chrome-line not-first:border-t"
    >
      <button
        type="button"
        data-no-app-focus
        data-testid={TEST_IDS.networkChainRowHead}
        aria-expanded={open}
        aria-controls={detailId}
        className="col-span-full grid grid-cols-subgrid items-center rounded-lg py-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus"
        onClick={() => setOpen(wasOpen => !wasOpen)}
      >
        <ChainHealthMark mark={mark} role={chain.role} />
        <span className="flex min-w-0 flex-col gap-0">
          <span
            data-testid={TEST_IDS.networkChainRowName}
            className={cnTw(
              'truncate text-sm font-semibold motion-safe:transition-colors motion-safe:duration-460 motion-safe:ease-chrome',
              setAside && 'text-chrome-muted',
            )}
          >
            {name}
          </span>
          <span
            data-testid={TEST_IDS.networkChainRowStatus}
            data-tone={line.tone ?? undefined}
            className={cnTw(
              'truncate text-xs tabular-nums motion-safe:transition-colors motion-safe:duration-460 motion-safe:ease-chrome',
              {
                'text-chrome-muted': line.tone === null,
                'text-chrome-warn-text': line.tone === 'warn',
                'text-chrome-err-text': line.tone === 'err',
              },
            )}
          >
            {translateStatus(t, line.text)}
          </span>
        </span>
        <ChevronDownIcon
          className={cnTw('size-3.5 text-chrome-muted transition-[rotate] duration-260 ease-chrome', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          id={detailId}
          data-testid={TEST_IDS.networkChainRowDetail}
          className="col-span-2 col-start-2 flex flex-col gap-2 pb-3"
        >
          <p className="flex items-baseline justify-between gap-2 text-xs whitespace-nowrap text-chrome-muted tabular-nums">
            <span>
              {t('feature.networkStatus.lastBlocks', { count: HISTORY_SLOTS })}
              {peers && (
                <>
                  {t('feature.networkStatus.separator')}
                  <span
                    data-testid={TEST_IDS.networkChainRowPeers}
                    data-tone={peers.count === 0 ? 'warn' : undefined}
                    title={t('feature.networkStatus.peers.label', { chain: name, peers: peers.text })}
                    className={cnTw(peers.count === 0 && 'text-chrome-warn-text')}
                  >
                    {peers.text}
                  </span>
                </>
              )}
            </span>
            {newest && (
              <span data-testid={TEST_IDS.networkChainRowBlock} className="font-mono text-2xs text-chrome-text">
                {t('feature.networkStatus.block.newest', { number: newest.number })}
              </span>
            )}
          </p>
          <BlockStrip chain={chain} chainName={name} pending={networkStatusService.pickPendingBar(chain, health)} />
        </div>
      )}
    </div>
  );
};
