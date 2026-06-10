import { type LucideProps } from 'lucide-react';

import PolkadotLogo from '@/shared/assets/images/logo-icon.svg?jsx';
import { cnTw } from '@/shared/utils';

const SIZE_CLASSES: Record<number, string> = {
  20: 'size-5',
  40: 'size-10',
};

const resolveSize = (size: LucideProps['size']) => {
  const numericSize = typeof size === 'string' ? Number(size) : size;
  return typeof numericSize === 'number' && Number.isFinite(numericSize) ? numericSize : 20;
};

export const PolkadotPermissionIcon = ({ size = 20, className }: Pick<LucideProps, 'size' | 'className'>) => {
  const resolvedSize = resolveSize(size);

  return <PolkadotLogo aria-hidden className={cnTw(SIZE_CLASSES[resolvedSize] ?? 'size-5', className)} />;
};
