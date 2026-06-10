import { type UserSession } from '@novasamatech/host-papp';
import { Observable } from 'rxjs';

import { type ChatSession } from '@/domains/chat';
import {
  type FetchResolver,
  type Product,
  type ProductWorkerInstance,
  createProductWorker,
  defaultWorkerBindings,
} from '@/domains/product';

import { productWorkerRegistry } from './state/registry';

type CreateInstanceParams = {
  contenthash: string;
  files: Record<string, Uint8Array>;
  entrypoint: string;
  fetchResolver: FetchResolver;
  getProduct: () => Product;
  getSession: () => UserSession | null;
  getChatSessions: () => ChatSession[];
};

/**
 * Emits the live `ProductWorkerInstance` for a (product, content) pair and
 * keeps it registered in the aggregate's registry. Unsubscribing disposes
 * the worker and unregisters it — the subscription IS the lifetime.
 */
function createInstance$({
  contenthash,
  files,
  entrypoint,
  fetchResolver,
  getProduct,
  getSession,
  getChatSessions,
}: CreateInstanceParams): Observable<ProductWorkerInstance> {
  return new Observable<ProductWorkerInstance>(subscriber => {
    const baseName = getProduct().baseName;
    let instance: ProductWorkerInstance | null = null;
    let cancelled = false;

    createProductWorker({
      productId: baseName,
      contenthash,
      files,
      entrypoint,
      fetchResolver,
      deps: { getProduct, getSession, getChatSessions },
      bindings: defaultWorkerBindings,
    })
      .then(inst => {
        if (cancelled) {
          inst.dispose();
          return;
        }
        instance = inst;
        productWorkerRegistry.register(inst);
        subscriber.next(inst);
      })
      .catch(err => {
        console.error(`[ProductWorker] Failed to create worker for ${baseName}:`, err);
        subscriber.error(err);
      });

    return () => {
      cancelled = true;
      if (instance) {
        productWorkerRegistry.unregister(instance);
        instance.dispose();
      }
    };
  });
}

export const lifecycleUseCase = {
  createInstance$,
};
