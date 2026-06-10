import { AppIcon, ProductHeader } from '@novasamatech/tr-ui';
import { type ReactNode } from 'react';

import { type Product, type ProductHeaderViewModel, useProductHeaderProps } from '@/domains/product';

type Props = {
  product?: Nullable<Product>;
  /** AppIcon fallback when `iconSrc` is unavailable (native products, add-widget entries). */
  icon?: ReactNode;
} & Partial<ProductHeaderViewModel>;

export const ProductDialogHeader = ({ product, icon, name, description, iconSrc }: Props) => {
  const fromProduct = useProductHeaderProps({
    product: product ?? null,
    fallbackName: name ?? '',
    fallbackDomain: description,
  });

  const header: ProductHeaderViewModel = {
    name: name ?? fromProduct.name,
    description: description ?? fromProduct.description,
    iconSrc: iconSrc ?? fromProduct.iconSrc,
  };

  const showDescription = Boolean(header.description && header.description !== header.name);

  if (icon && !header.iconSrc) {
    return (
      <div data-slot="product-header" className="flex min-w-0 gap-4">
        <AppIcon alt={header.name} size="lg">
          <span className="flex size-7 items-center justify-center overflow-hidden [&_svg]:size-full">{icon}</span>
        </AppIcon>
        <div className="flex min-w-0 flex-col justify-center">
          <span className="truncate text-base leading-6 font-semibold text-fg-primary">{header.name}</span>
          {showDescription ? (
            <span className="truncate text-sm leading-5 font-normal text-fg-secondary">{header.description}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return <ProductHeader {...header} />;
};
