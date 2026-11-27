import { type FC, useState } from 'react';

import { Button, DismissOverlay, Popover } from '@/shared/components';
import { useCloseOnWindowLeave } from '@/shared/hooks';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { useChainHealth } from '../hooks/useChainHealth';
import { networkStatusService } from '../service';

import { ChainHealthMark } from './ChainHealthMark';
import { NetworkPanel } from './NetworkPanel';

export const NetworkButton: FC = () => {
  const { t } = useTranslation();
  const { chains } = useChainHealth();
  const [open, setOpen] = useState(false);

  useCloseOnWindowLeave(open, () => setOpen(false));

  const known = chains.filter(({ chain }) => chain.role !== null);
  if (known.length === 0) {
    return null;
  }

  const title = t('feature.networkStatus.title');

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <DismissOverlay open={open} testId={TEST_IDS.dismissOverlay} onDismiss={() => setOpen(false)} />
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          horizontalSize="condensed"
          aria-label={title}
          title={title}
          data-testid={TEST_IDS.networkStatusButton}
        >
          {/* Keeps the marks 4 px apart against `Button`'s `gap-1.5`. */}
          <span className="flex items-center gap-1">
            {known.map(({ chain, health }) => (
              <ChainHealthMark
                key={chain.genesisHash}
                size="sm"
                mark={networkStatusService.pickChainMark(health)}
                role={chain.role}
              />
            ))}
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Content align="end" aria-label={title}>
        <NetworkPanel />
      </Popover.Content>
    </Popover.Root>
  );
};
