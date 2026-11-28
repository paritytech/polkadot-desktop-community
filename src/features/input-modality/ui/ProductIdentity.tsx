import { PackageIcon } from '@/shared/icons';
import { cnTw } from '@/shared/utils';
import { usePersistedProductById } from '@/domains/product';
import { ProductIcon } from '@/widgets/ProductIcon';

type Props = {
  productId: string;
  /** Larger frame for the attachment picker, where the user is choosing a recipient. */
  prominent?: boolean;
};

/**
 * The frame the host draws around anything attributed to a product — RFC-0027
 * § Candidate content.
 *
 * The identity is read from the product's own manifest, never from the thing
 * being framed, which is what makes spoofing structurally impossible: a product
 * can write any text it likes and still cannot present it as coming from another.
 *
 * Drawing the icon is not the fetch RFC-0027 § Security forbids. That rule bars
 * resolving *candidate-supplied* URLs to render the list, because the request
 * tells the product's server that this user saw this candidate. A manifest icon
 * is host-side identity for a product the user already installed,
 * content-addressed, and already cached by the dashboard and tab strip — it
 * discloses nothing the query itself did not.
 */
export const ProductIdentity = ({ productId, prominent }: Props) => {
  const { data: product } = usePersistedProductById(productId);
  const iconSize = prominent ? 'size-4' : 'size-3';

  return (
    <span
      className={cnTw(
        'flex min-w-0 items-center gap-1 text-fg-secondary',
        prominent ? 'flex-1 gap-2 text-sm text-fg-primary' : 'text-xs',
      )}
    >
      {/* Empty alt: the name beside it already carries the identity, so a label
          here would make every candidate announce its product twice. */}
      <ProductIcon
        icon={product?.icon}
        className={cnTw('shrink-0 rounded-xs object-cover', iconSize)}
        fallback={<PackageIcon className={cnTw('shrink-0', iconSize)} />}
      />
      <span className="min-w-0 truncate">{product?.displayName ?? productId}</span>
    </span>
  );
};
