import { type ReactNode } from 'react';

import { type Product } from '@/domains/product';
import { type ProductHeaderViewModel, ProductHeader, useProductHeaderProps } from '@/widgets/ProductHeader';

type Props = {
  product?: Nullable<Product>;
  /** The icon tile's fallback when the product has no icon image (native products, add-widget entries). */
  icon?: ReactNode;
} & Partial<ProductHeaderViewModel>;

export const ProductDialogHeader = ({ product, icon, name, description, iconSrc }: Props) => {
  const fromProduct = useProductHeaderProps({
    product: product ?? null,
    fallbackName: name ?? '',
    fallbackDomain: description,
  });

  return (
    <ProductHeader
      name={name ?? fromProduct.name}
      description={description ?? fromProduct.description}
      iconSrc={iconSrc ?? fromProduct.iconSrc}
      icon={
        icon ? (
          <span className="flex size-7 items-center justify-center overflow-hidden [&_svg]:size-full">{icon}</span>
        ) : undefined
      }
    />
  );
};
