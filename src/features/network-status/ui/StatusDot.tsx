import { type FC } from 'react';

import { TEST_IDS } from '@/shared/test-ids';
import { cnTw } from '@/shared/utils';
import { type StatusTone } from '../types';

type Props = {
  tone: StatusTone;
  label: string;
};

export const StatusDot: FC<Props> = ({ tone, label }) => (
  <span
    role="img"
    aria-label={label}
    data-tone={tone}
    data-testid={TEST_IDS.networkStatusDot}
    className={cnTw(
      'inline-block size-2 flex-none rounded-full ring-3',
      tone === 'ok' && 'bg-chrome-ok ring-chrome-ok/22',
      tone === 'idle' && 'bg-chrome-idle ring-chrome-idle/22',
      tone === 'warn' && 'bg-chrome-warn ring-chrome-warn/22',
      tone === 'err' && 'bg-chrome-err ring-chrome-err/22',
    )}
  />
);
