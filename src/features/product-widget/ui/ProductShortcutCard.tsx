import { useNavigate } from '@tanstack/react-router';
import { memo } from 'react';

import PolkadotIcon from '@/shared/assets/images/polkadot-half-logo.svg?jsx';
import { type Icon, dotNsService, usePersistedProductById } from '@/domains/product';
import { ShortcutIcon, getProductIcon } from '@/features/dashboard';
import { ProductIcon } from '@/widgets/ProductIcon';

type Props = {
  productId: string;
};

// 1x1 shortcut presentation for a product card. Skips the chrome — clicking
// navigates straight to the full-screen product route.
export const ProductShortcutCard = memo(({ productId }: Props) => {
  const navigate = useNavigate();
  const { data: product } = usePersistedProductById(productId);

  const handleClick = () => {
    navigate({ to: '/product/$id/{-$route}', params: { id: productId } });
  };

  const NativeIcon = getProductIcon(productId);
  const displayLabel = product ? dotNsService.toShortLabel(product.baseName) : productId;
  const icon: Icon = product?.icon ?? { cid: '', format: 'png' };
  const displayName = product?.displayName ?? productId;

  return (
    <ShortcutIcon
      widgetId={productId}
      customIcon={
        NativeIcon ? (
          <NativeIcon className="h-8 w-8 text-[var(--icon-accent)]" />
        ) : (
          <ProductIcon
            icon={icon}
            alt={displayName}
            className="h-8 w-8 rounded-lg object-cover"
            fallback={<PolkadotIcon className="h-8 w-8 text-[var(--icon-accent)]" />}
          />
        )
      }
      label={displayLabel}
      onClick={handleClick}
    />
  );
});
