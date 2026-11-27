import { type SVGProps } from 'react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';
import { cnTw } from '@/shared/utils';

export const PolkadotPermissionIcon = ({ className }: Pick<SVGProps<SVGSVGElement>, 'className'>) => (
  <PolkadotLogo aria-hidden className={cnTw('size-5', className)} />
);
