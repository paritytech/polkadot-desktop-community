import './index.css';

import { ThemeProvider, Toaster, defaultTheme } from '@novasamatech/tr-ui';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';

import { ElectronSplashScreen, FallbackScreen, WebSplashScreen } from '@/shared/components';
import { isElectron, reloadApp } from '@/shared/env';
import { resetFeatureStatuses, updateFeatureStatus } from '@/shared/feature-config';
import { useBrowserTheme } from '@/shared/hooks';
import { Sentry, initSentry } from '@/shared/sentry';
import { TranslationProvider } from '@/shared/translation';
import { delay } from '@/shared/utils';
import { ThemeSyncer } from '@/features/theme-toggle';

import { LoadingDelay, controlledLazy } from './DelayedSuspense';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- module augmentation requires interface
  interface CSSProperties {
    appRegion?: 'drag' | 'no-drag';
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface Window {
    __browser_config: {
      enableFeature(name: string): void;
      disableFeature(name: string): void;
      resetFeatureConfig(): void;
    };
    __rendererConsoleLoggingInstalled?: boolean;
  }
}

window.__browser_config = {
  enableFeature: name => updateFeatureStatus([name, true]),
  disableFeature: name => updateFeatureStatus([name, false]),
  resetFeatureConfig: () => resetFeatureStatuses(),
};

const CLEAR_LOADING_TIMEOUT = 700;
const DIRTY_LOADING_TIMEOUT = 2000;

const App = controlledLazy(() => import('./App').then(m => m.App));

const setupRendererConsoleLogging = () => {
  if (!isElectron() || !window.App?.logRendererConsole) return;
  if (window.__rendererConsoleLoggingInstalled) return;
  window.__rendererConsoleLoggingInstalled = true;

  const originalConsoleInfo = console.info.bind(console);
  console.info = (...values: unknown[]) => {
    originalConsoleInfo(...values);
    window.App.logRendererConsole('info', values);
  };

  const originalConsoleWarn = console.warn.bind(console);
  console.warn = (...values: unknown[]) => {
    originalConsoleWarn(...values);
    window.App.logRendererConsole('warn', values);
  };

  const originalConsoleError = console.error.bind(console);
  console.error = (...values: unknown[]) => {
    // Mute the polkadot-api chain-follow unpin chatter (`console.error("unpin", err)`
    // in `@novasamatech/host-substrate-chain-connection`). It fires whenever the
    // server has already evicted the block we're trying to unpin (finalised /
    // reorged) — benign, but it floods the renderer console.
    if (values[0] === 'unpin' && values[1] instanceof Error && /Invalid block hash/i.test(values[1].message)) {
      return;
    }
    originalConsoleError(...values);
    window.App.logRendererConsole('error', values);
  };

  window.addEventListener('error', event => {
    window.App.logRendererConsole('error', [
      '[window:error]',
      event.message,
      event.filename,
      `line:${event.lineno}`,
      `column:${event.colno}`,
      event.error,
    ]);
  });

  window.addEventListener('unhandledrejection', event => {
    window.App.logRendererConsole('error', ['[window:unhandledrejection]', event.reason]);
  });
};

initSentry();
setupRendererConsoleLogging();

/**
 * All this loading logic can be described like this:
 *
 * If App component loads before `CLEAR_LOADING_TIMEOUT` timeout it shows
 * immediately, else splash screen appears for at least DIRTY_LOADING_TIMEOUT.
 */
const Root = () => {
  const [renderSplashScreen, setRenderSplashScreen] = useState(false);
  const [appLoaded, setAppLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setRenderSplashScreen(true);
    }, CLEAR_LOADING_TIMEOUT);
  }, []);

  const loadingDelay = useMemo(() => {
    if (renderSplashScreen && !appLoaded) {
      return delay(DIRTY_LOADING_TIMEOUT);
    }

    return null;
  }, [renderSplashScreen, appLoaded]);

  const splashScreen = renderSplashScreen ? isElectron() ? <ElectronSplashScreen /> : <WebSplashScreen /> : null;

  const browserTheme = useBrowserTheme();

  return (
    <TranslationProvider>
      <ThemeProvider theme={defaultTheme} defaultMode={browserTheme}>
        <ThemeSyncer />
        <ErrorBoundary
          FallbackComponent={FallbackScreen}
          onError={(error, errorInfo) => {
            Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
            const message = error ? error.toString() : '';
            console.error(message);
            console.error(errorInfo.componentStack);
            if (message.includes('Failed to fetch dynamically imported module')) {
              reloadApp();
            }
          }}
        >
          <Suspense fallback={splashScreen}>
            <App onReady={() => setAppLoaded(true)} />
            {loadingDelay && <LoadingDelay suspense={loadingDelay} />}
          </Suspense>
        </ErrorBoundary>
        <Toaster />
      </ThemeProvider>
    </TranslationProvider>
  );
};

const container = document.getElementById('app');
if (!container) {
  throw new Error('Root container is missing in index.html');
}

// document.body.style.minWidth = `1366px`;

// NOTE: React 18 Strict mode renders twice in DEV mode
// which leads to errors in components that use camera
// https://reactjs.org/docs/strict-mode.html#ensuring-reusable-state
createRoot(container).render(<Root />);
