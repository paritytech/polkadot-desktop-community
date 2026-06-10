import { Input } from '@novasamatech/tr-ui';
import { useNavigate } from '@tanstack/react-router';
import { Grid2X2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ListItem, SettingsList } from '@/shared/components';
import { useTranslation } from '@/shared/translation';
import { type Icon, isLocalhostUrl, productService, useDisplayedProduct, useInteractedProducts } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';

export const ProductListSettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: interacted } = useInteractedProducts();
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  // Permission-only entries resolve their display name lazily inside each row,
  // so the list-level filter can only match their baseName (.dot address);
  // committed entries match on their resolved fields.
  const filtered = useMemo(() => {
    if (!normalizedQuery) return interacted;

    return interacted.filter(entry =>
      entry.kind === 'committed'
        ? productService.matchesQuery(entry.product, normalizedQuery)
        : entry.productId.toLowerCase().includes(normalizedQuery),
    );
  }, [interacted, normalizedQuery]);

  const openProduct = (productId: string) => {
    navigate({ to: '/settings/privacy/apps/$productId', params: { productId } });
  };

  return (
    <SettingsList title={t('feature.productSettings.title')} subtitle={t('feature.productSettings.subtitle')}>
      <div className="flex flex-col gap-6">
        <Input
          type="search"
          value={query}
          placeholder={t('feature.productSettings.searchPlaceholder')}
          aria-label={t('feature.productSettings.searchAriaLabel')}
          onChange={event => setQuery(event.target.value)}
        />

        <div className="flex flex-col">
          {filtered.map(entry =>
            entry.kind === 'committed' ? (
              <ProductRow
                key={entry.product.baseName}
                icon={entry.product.icon}
                label={entry.product.displayName}
                description={entry.product.baseName}
                onClick={() => openProduct(entry.product.baseName)}
              />
            ) : (
              <PermissionOnlyProductRow
                key={entry.productId}
                productId={entry.productId}
                onClick={() => openProduct(entry.productId)}
              />
            ),
          )}
        </div>
      </div>
    </SettingsList>
  );
};

const ProductRow = ({
  icon,
  label,
  description,
  onClick,
}: {
  icon: Nullable<Icon>;
  label: string;
  description: string;
  onClick: VoidFunction;
}) => (
  <ListItem
    icon={<ProductIcon icon={icon} className="size-full rounded-xl object-cover" fallback={<Grid2X2 size={16} />} />}
    variant="icon"
    label={label}
    description={description}
    onClick={onClick}
  />
);

// A product with stored permissions but no committed row — resolved from chain
// lazily per row; falls back to the baseName while pending or unresolvable.
// localhost identifiers are never on chain — skip the resolution entirely
// (same guard as `Webview`).
const PermissionOnlyProductRow = ({ productId, onClick }: { productId: string; onClick: VoidFunction }) => {
  const { data: product } = useDisplayedProduct(isLocalhostUrl(productId) ? null : productId);

  return (
    <ProductRow
      icon={product?.icon ?? null}
      label={product?.displayName ?? productId}
      description={productId}
      onClick={onClick}
    />
  );
};
