import { type ReactNode } from 'react';

import { AppIcon } from '@/shared/components';

import { type ProductHeaderViewModel } from './hooks';

type Props = ProductHeaderViewModel & {
  /** What the icon tile draws when the product has no icon image, or its image fails. */
  icon?: ReactNode;
};

export const ProductHeader = ({ name, description, iconSrc, icon }: Props) => (
  <div data-slot="product-header" className="flex min-w-0 gap-4">
    <AppIcon size="44" src={iconSrc} alt={name}>
      {icon}
    </AppIcon>
    <div className="flex min-w-0 flex-col justify-center">
      <span className="truncate text-base font-semibold text-fg-primary">{name}</span>
      {description && description !== name ? <span className="truncate text-sm text-fg-secondary">{description}</span> : null}
    </div>
  </div>
);
