import { DeriveEntropyErr } from '@novasamatech/host-api';
import { type Container, deriveProductEntropyFromSource } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { useEffect } from 'react';

import { useLooseRef } from '@/shared/hooks';
import { createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { useDisplayedProduct } from '@/domains/product';

import { createOnRateLimited } from './_helpers';

export function useEntropy(container: Container, identifier: string) {
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const { data: product } = useDisplayedProduct(identifier);
  const productRef = useLooseRef(product);
  const { session } = useSession();
  const sessionRef = useLooseRef(session);

  useEffect(() => {
    const getProductName = () => productRef()?.baseName ?? identifier;
    const rateLimiterDeriveEntropy = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'entropy', tRef()),
      mapErr: reason => new DeriveEntropyErr.Unknown({ reason }),
    });

    container.handleDeriveEntropy((key, { ok, err }) =>
      rateLimiterDeriveEntropy.schedule(() => {
        const session = sessionRef();
        if (!session) {
          return err(new DeriveEntropyErr.Unknown({ reason: 'Session not connected' }));
        }

        try {
          return ok(deriveProductEntropyFromSource(session.rootEntropySource, identifier, key));
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          return err(new DeriveEntropyErr.Unknown({ reason }));
        }
      }),
    );

    return () => {
      rateLimiterDeriveEntropy.destroy();
    };
  }, [container, identifier]);
}
