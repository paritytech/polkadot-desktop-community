import { useSession } from '@novasamatech/host-papp-react-ui';
import { useEffect, useState } from 'react';

import { useLooseRef, useRead } from '@/shared/hooks';
import { useProductSessions } from '@/domains/chat';
import { type Product, type ProductWorkerInstance, useExecutableArchive } from '@/domains/product';

import { lifecycleUseCase } from './lifecycleUseCase';
import { productWorkerRegistry } from './state/registry';
import { useWorkerFetchResolver } from './workerFetchResolver';

export function useProductWorker(product: Product): ProductWorkerInstance | null {
  const worker = product.executables.worker ?? null;
  const workerEntrypoint = worker?.entrypoint ?? null;
  const { data: content } = useExecutableArchive(worker ? { product, kind: 'worker' } : null);
  const { session } = useSession();
  const { data: chatSessions } = useProductSessions();

  const productRef = useLooseRef(product);
  const sessionRef = useLooseRef(session);
  const chatSessionsRef = useLooseRef(chatSessions);

  // Permission-gated `fetch` for the worker, built here (needs React) and passed into the factory.
  const fetchResolver = useWorkerFetchResolver(worker ? product.baseName : null);

  // The factory derives the entrypoint code from the archive (same resolver that backs imports),
  // so the hook only forwards the archive and the entrypoint to resolve against.
  const params =
    content && workerEntrypoint
      ? {
          contenthash: content.contenthash,
          files: content.archive.files,
          entrypoint: workerEntrypoint,
          fetchResolver,
          getProduct: productRef,
          getSession: sessionRef,
          getChatSessions: chatSessionsRef,
        }
      : null;

  const { data } = useRead(lifecycleUseCase.createInstance$, { params, key: p => p.contenthash });

  return data ?? null;
}

export function useProductWorkerInstance(productId: string): ProductWorkerInstance | null {
  const [instance, setInstance] = useState<ProductWorkerInstance | null>(() => productWorkerRegistry.get(productId));

  useEffect(() => {
    setInstance(productWorkerRegistry.get(productId));
    const sub = productWorkerRegistry.instance$(productId).subscribe(setInstance);
    return () => sub.unsubscribe();
  }, [productId]);

  return instance;
}
