import { TabHoverTitle } from '@/shared/components';
import { dotNsService, useDisplayedProduct } from '@/domains/product';

type Props = { id: string };

export const ProductTabHover = ({ id }: Props) => {
  // Same source as the AddressBar/tab chip: resolve committed-or-live so an
  // uncommitted tab still shows the product's real name, not the bare id.
  const { data: product } = useDisplayedProduct(id);
  const title = dotNsService.toDisplayName(product?.displayName ?? id);

  return (
    <div className="flex min-w-0 flex-col">
      <TabHoverTitle title={title} />
      <span className="truncate text-sm leading-[18px] text-text-primary">{id}</span>
    </div>
  );
};
