import { Globe } from 'lucide-react';
import { type FC, useState } from 'react';

import { DismissOverlay, IconButton, Popover } from '@/shared/components';
import { useCloseOnWindowLeave } from '@/shared/hooks';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { useNetworkHealth } from '@/aggregates/network-monitor';
import { BADGE_CUT_MASK, HEALTH_TONES } from '../constants';

import { NetworkPanel } from './NetworkPanel';

export const NetworkButton: FC = () => {
  const { t } = useTranslation();
  const health = useNetworkHealth();
  const tone = HEALTH_TONES[health];
  const [open, setOpen] = useState(false);

  useCloseOnWindowLeave(open, () => setOpen(false));

  const title = t('feature.networkStatus.title');

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <DismissOverlay open={open} testId={TEST_IDS.dismissOverlay} onDismiss={() => setOpen(false)} />
      <Popover.Trigger asChild>
        <IconButton label={title} title={title} data-testid={TEST_IDS.networkStatusButton}>
          <Globe className="size-4" strokeWidth={1.75} aria-hidden style={{ maskImage: BADGE_CUT_MASK }} />
          {/* Physical `right`, not `end`: the mask cuts the icon at its physical top-right in either direction. */}
          <span
            aria-hidden
            data-tone={tone}
            className={cnTw(
              'pointer-events-none absolute top-1 right-1 size-1.5 rounded-full',
              tone === 'ok' && 'bg-chrome-ok',
              tone === 'idle' && 'bg-chrome-muted',
              tone === 'warn' && 'bg-chrome-warn',
              tone === 'err' && 'bg-chrome-err',
            )}
          />
        </IconButton>
      </Popover.Trigger>
      <Popover.Content align="end" aria-label={title}>
        <NetworkPanel />
      </Popover.Content>
    </Popover.Root>
  );
};
