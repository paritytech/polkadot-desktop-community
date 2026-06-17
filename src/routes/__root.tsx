import { Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { RouteErrorFallback } from '@/shared/components';
import { useSideEffect } from '@/shared/di';
import { usePappProvider } from '@/domains/application';
import { dotNsService } from '@/domains/product';
import { P2PChatBinding } from '@/aggregates/p2p-chat';
import { AppShell } from '@/features/app-shell';
import { Browser, openDotNsUrlSideEffect } from '@/features/browser';
import { UpdateCheckProvider } from '@/features/update-check';

/**
 * Handles deeplink navigation from the Electron main process.
 *
 * The main process sends the raw `polkadot://` URL via the `protocol-open`
 * IPC channel. This hook parses it with `dotNsService.parseDotNsDomain` and
 * navigates using typed TanStack Router params — the same format used
 * everywhere else in the app.
 *
 * On mount, `notifyDeepLinkReady` signals the main process that the renderer
 * is ready. Any cold-start deeplink stored before the SPA mounted is then
 * flushed as a `protocol-open` message. Because the IPC round-trip is
 * asynchronous, the listener registered just before the signal is guaranteed
 * to be in place before the flushed message arrives.
 *
 * This hook is a no-op in the web (non-Electron) build where `window.App`
 * is not defined.
 */
const useDeepLinkNavigation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const cleanup = window.App?.onProtocolOpen(url => {
      const dotNsUrl = dotNsService.parseDotNsDomain(url);
      if (!dotNsUrl) return;

      navigate({ to: '/product/$id/{-$route}', params: { id: dotNsUrl.identifier, route: dotNsUrl.pathname } });
    });

    // Signal readiness AFTER registering the listener so the flush from the
    // main process arrives after the listener is in place.
    window.App?.notifyDeepLinkReady();

    return cleanup;
  }, [navigate]);
};

const useOpenDotNsUrlNavigation = () => {
  const navigate = useNavigate();

  useSideEffect(openDotNsUrlSideEffect, ({ identifier, pathname }) => {
    void navigate({ to: '/product/$id/{-$route}', params: { id: identifier, route: pathname } });
  });
};

const RootLayout = () => {
  const { location } = useRouterState();
  const isOnboarding = location.pathname === '/onboarding';
  const isProductRoute = location.pathname.startsWith('/product/');
  const papp = usePappProvider();

  useDeepLinkNavigation();
  useOpenDotNsUrlNavigation();

  return (
    <UpdateCheckProvider>
      {isOnboarding ? (
        <Outlet />
      ) : (
        <>
          <P2PChatBinding pappProvider={papp} />
          <AppShell>
            <div className="h-full w-full" style={{ display: isProductRoute ? 'none' : undefined }}>
              <Outlet />
            </div>
            <div className="h-full w-full" style={{ display: isProductRoute ? undefined : 'none' }}>
              <Browser />
            </div>
          </AppShell>
        </>
      )}
    </UpdateCheckProvider>
  );
};

export const Route = createRootRoute({ component: RootLayout, errorComponent: RouteErrorFallback });
