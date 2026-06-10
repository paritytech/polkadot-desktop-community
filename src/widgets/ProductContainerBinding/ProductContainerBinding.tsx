import { GenericError } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { type JsonRpcProvider } from '@polkadot-api/json-rpc-provider';
import { useNavigate } from '@tanstack/react-router';
import { memo, useEffect, useRef } from 'react';
import * as v from 'valibot';

import { useLooseRef } from '@/shared/hooks';
import { type RateLimiter, createDefaultRateLimiter } from '@/shared/rateLimiter';
import { useTranslation } from '@/shared/translation';
import { type HexString } from '@/shared/types';
import { chainRegistry, genesisHash, useAllChainsMap } from '@/domains/network';
import { type PermissionModality, usePersistedProductById } from '@/domains/product';
import { dotNsService } from '@/domains/product';

import { createOnRateLimited } from './integrations/_helpers';
import { useAccounts } from './integrations/accounts';
import { useEntropy } from './integrations/entropy';
import { useLocalStorage } from './integrations/localStorage';
import { useLogin } from './integrations/login';
import { useNotifications } from './integrations/notifications';
import { usePermissions } from './integrations/permissions';
import { usePreimage } from './integrations/preimage';
import { useSigning } from './integrations/signing';
import { useStatementStore } from './integrations/statementStore';
import { useTheme } from './integrations/theme';

type Props = {
  container: Container;
  identifier: string;
  /** Access surface this container binds — permission reads/writes are scoped to it. Workers bind as 'app'. */
  modality: PermissionModality;
};

export const ProductContainerBinding = memo(({ container, identifier, modality }: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigateRef = useLooseRef(navigate);
  const tRef = useLooseRef(t);

  const { data: chains } = useAllChainsMap();
  const chainsRef = useLooseRef(chains);

  const { data: product } = usePersistedProductById(identifier);
  const productRef = useLooseRef(product);

  const lastProductChainGenesisRef = useRef<HexString | null>(null);

  useEffect(() => {
    if (!container) return;

    const getProductName = () => productRef()?.baseName ?? identifier;

    const rateLimiterRpc = createDefaultRateLimiter({
      maxQueuedRequests: 500,
      maxRequestsPerInterval: 100,
      intervalMs: 1000,
      strategy: 'queue',
      onRateLimited: createOnRateLimited(identifier, getProductName, 'rpc', tRef()),
      mapErr: reason => new GenericError({ reason }),
    });
    const rateLimiterFeatureSupported = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'featureSupport', tRef()),
      mapErr: reason => new GenericError({ reason }),
    });
    const rateLimiterNavigation = createDefaultRateLimiter({
      onRateLimited: createOnRateLimited(identifier, getProductName, 'navigation', tRef()),
      mapErr: reason => new GenericError({ reason }),
    });

    const rateLimiters = [rateLimiterRpc, rateLimiterFeatureSupported, rateLimiterNavigation];

    // chain connection

    const cleanupFeatureSupported = container.handleFeatureSupported((params, { ok }) =>
      rateLimiterFeatureSupported.schedule(() => {
        switch (params.tag) {
          case 'Chain': {
            const chains = chainsRef();
            return ok(params.value in chains);
          }
          default:
            return ok(false);
        }
      }),
    );

    const cleanupChainConnection = container.handleChainConnection(genesisRaw => {
      const id = v.parse(genesisHash, genesisRaw);
      lastProductChainGenesisRef.current = id;
      const chains = chainsRef();
      const chain = chains[id];

      const baseProvider = chain ? chainRegistry.getProvider(chain) : null;
      if (!baseProvider) return null;

      return createPAPIProvider(baseProvider, rateLimiterRpc);
    });

    const cleanupNavigateTo = container.handleNavigateTo((url, { ok }) =>
      rateLimiterNavigation.schedule(() => {
        const dotNsUrl = dotNsService.parseDotNsDomain(url);
        if (dotNsUrl && dotNsService.isDotDomain(dotNsUrl.identifier)) {
          if (url.startsWith('polkadot://')) {
            const crossProductLink = dotNsService.parseDotNsDomain(dotNsUrl.pathname);
            if (crossProductLink && dotNsService.isDotDomain(crossProductLink.identifier)) {
              navigateRef()({
                to: '/product/$id/{-$route}',
                params: { id: crossProductLink.identifier, route: crossProductLink.pathname },
              });
            }
          } else {
            navigateRef()({ to: '/product/$id/{-$route}', params: { id: dotNsUrl.identifier, route: dotNsUrl.pathname } });
          }
        } else {
          window.open(url, '_blank');
        }
        return ok(undefined);
      }),
    );

    return () => {
      cleanupFeatureSupported();
      cleanupChainConnection();
      cleanupNavigateTo();
      for (const limiter of rateLimiters) {
        limiter.destroy();
      }
    };
  }, [identifier, container]);

  useLocalStorage(container, identifier);
  useStatementStore(container, identifier);
  useNotifications(container, identifier);
  useAccounts(container, identifier, modality);
  usePermissions(container, identifier, modality);
  useTheme(container);
  useLogin(container, identifier);
  useEntropy(container, identifier);

  usePreimage(container, identifier);

  return useSigning(container, identifier, lastProductChainGenesisRef);
});

const createPAPIProvider = (baseProvider: JsonRpcProvider, limiter: RateLimiter): JsonRpcProvider => {
  return listener => {
    const connection = baseProvider(listener);

    return {
      send: msg => {
        limiter
          .schedule(() => {
            connection.send(msg);
          })
          .catch((error: unknown) => {
            console.error('RPC send rate-limited or failed', error);
          });
      },
      disconnect: connection.disconnect,
    };
  };
};
