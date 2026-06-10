import '@novasamatech/host-papp-react-ui/styles.css';

import { PairingModal, PappProvider } from '@novasamatech/host-papp-react-ui';
import { useTheme } from '@novasamatech/tr-ui';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { ConfirmationProvider, FallbackScreen } from '@/shared/components';
import { useBodyLockTracer, useResetAppData, useScrollLockGuard } from '@/shared/hooks';
import { usePappProvider } from '@/domains/application';
import { clearAllOutboxRecords } from '@/domains/chat';
import { userIdentity$ } from '@/domains/sso';
import { RemotePermissionPromptHost } from '@/widgets/Permission';

import { PageLoadingState } from './PageLoadingState';
import { bootstrap } from './bootstrap';
import { router } from './router';

const version = process.env['VERSION'];
const buildTime = process.env['BUILD_TIME'];
console.info(`Polkadot Desktop v${version} (built ${buildTime})`);

// `bootstrap()` is async: it awaits the first Remote Config fetch before any
// config (chains/ipfs/dotNS/identity) is read. Fired once here; the app holds on
// the loading state until it resolves.
const bootstrapPromise = bootstrap();

export const App = () => {
  const { mode } = useTheme();
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const pappProvider = usePappProvider();
  // The SDK-owned device + user identity live in `polkadot_*` localStorage,
  // which `useResetAppData`'s sweep already wipes; we only need to flip the
  // reactive handle so live consumers tear down before the reload. The chat
  // outbox records live under their own `p2p-chat-outbox:` prefix, which the
  // `polkadot_*` sweep does NOT cover — clear them here or a reset leaves
  // orphan per-peer queues behind.
  useResetAppData(() => {
    userIdentity$.set(null);
    clearAllOutboxRecords();
  });
  useScrollLockGuard();
  useBodyLockTracer();

  useEffect(() => {
    bootstrapPromise
      .then(() => setBootstrapReady(true))
      .catch((error: unknown) => {
        // Config is fetched from Remote Config with no bundled fallback — if it's
        // unavailable (offline fresh install, missing creds, first-fetch failure)
        // bootstrap rejects. Surface a retry screen instead of an endless loader.
        console.error('[bootstrap] failed to initialize', error);
        setBootstrapFailed(true);
      });
  }, []);

  if (bootstrapFailed) {
    return <FallbackScreen />;
  }

  if (!bootstrapReady || !pappProvider) {
    return <PageLoadingState />;
  }

  return (
    <PappProvider adapter={pappProvider}>
      <ConfirmationProvider>
        <RouterProvider router={router} />
        <PairingModal theme={mode} size={240} />
        <RemotePermissionPromptHost />
      </ConfirmationProvider>
    </PappProvider>
  );
};
