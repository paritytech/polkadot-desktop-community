import { useSession } from '@novasamatech/host-papp-react-ui';
import { toHex } from '@novasamatech/scale';

import { usePersistedProducts } from '@/domains/product';
import { ProductWorker } from '@/widgets/ProductWorker';

export const WorkersManager = () => {
  const { session } = useSession();
  const { data: products } = usePersistedProducts();
  const accountId = session ? toHex(session?.localAccount.accountId) : '';

  return (
    <>
      {products.map(product => (
        <ProductWorker key={`${product.baseName}-${accountId}`} product={product} />
      ))}
    </>
  );
};
