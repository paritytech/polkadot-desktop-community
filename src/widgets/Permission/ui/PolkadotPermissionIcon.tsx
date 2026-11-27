import { type SVGProps } from 'react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';

export const PolkadotPermissionIcon = ({ className }: Pick<SVGProps<SVGSVGElement>, 'className'>) => (
  <PolkadotLogo aria-hidden className={className} />
);
