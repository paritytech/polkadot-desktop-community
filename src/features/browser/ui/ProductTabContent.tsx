import PlaceholderIcon from '@/shared/assets/images/header/placeholder.svg?jsx';
import { TabChip, tabIconClassName } from '@/shared/components';
import { dotNsService, useDisplayedProduct, useProductIcon } from '@/domains/product';

type Props = { id: string; setDeeplink: (deeplink: string) => void; isActive: boolean };

// `setDeeplink` is available for product tab content that drives its own state; the product
// webview's in-page navigation updates the deeplink from Browser.tsx instead, so this
// renderer just draws icon + label today. Keep the prop in the signature (the slot provides it).
export const ProductTabContent = ({ id, isActive }: Props) => {
  // Resolve the product (committed row or live chain resolve) — same source as the
  // AddressBar. Reading only the installed list would leave a not-yet-installed tab
  // without an icon/name even though it resolves fine elsewhere.
  const { data: product } = useDisplayedProduct(id);
  const { data: iconUrl } = useProductIcon(product?.icon ?? null);
  const label = dotNsService.toDisplayName(product?.displayName ?? id);

  // A resolved icon shows always; products without one render the label alone
  // (centered) and only fall back to the placeholder in the collapsed icon-only state.
  return (
    <TabChip
      icon={iconUrl ? <img src={iconUrl} alt="" className={tabIconClassName} /> : undefined}
      placeholder={iconUrl ? undefined : <PlaceholderIcon className={tabIconClassName} aria-hidden />}
      isActive={isActive}
      label={label}
    />
  );
};
