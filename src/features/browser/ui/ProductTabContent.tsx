import { TabChip } from '@/shared/components';
import { useDisplayedProduct, useDotNsLabels } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';

type Props = { id: string; setDeeplink: (deeplink: string) => void; isActive: boolean };

// `setDeeplink` is available for product tab content that drives its own state; the product
// webview's in-page navigation updates the deeplink from Browser.tsx instead, so this
// renderer just draws icon + label today. Keep the prop in the signature (the slot provides it).
export const ProductTabContent = ({ id, isActive }: Props) => {
  // Resolve the product (committed row or live chain resolve) — same source as the
  // AddressBar. Reading only the installed list would leave a not-yet-installed tab
  // without an icon/name even though it resolves fine elsewhere.
  const { data: product } = useDisplayedProduct(id);
  const labels = useDotNsLabels();
  const label = labels.displayName(product?.displayName ?? id);

  // ProductIcon renders nothing for a missing or broken icon, and TabChip then shows the label alone.
  return <TabChip icon={<ProductIcon icon={product?.icon ?? null} />} isActive={isActive} label={label} />;
};
