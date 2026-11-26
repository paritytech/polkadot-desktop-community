import { TabHoverTitle } from '@/shared/components';
import { useDisplayedProduct, useDotNsLabels } from '@/domains/product';
import { PinIndicator } from '@/widgets/PinIndicator';

type Props = { id: string };

export const ProductTabHover = ({ id }: Props) => {
  // Same source as the AddressBar/tab chip: resolve committed-or-live so an
  // uncommitted tab still shows the product's real name, not the bare id.
  const { data: product } = useDisplayedProduct(id);
  const labels = useDotNsLabels();
  const title = labels.displayName(product?.displayName ?? id);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-w-0 items-center gap-1 text-fg-secondary">
        <TabHoverTitle title={title} />
        <PinIndicator productId={product?.baseName ?? id} />
      </div>
      <span className="truncate text-sm text-fg-primary">{id}</span>
    </div>
  );
};
