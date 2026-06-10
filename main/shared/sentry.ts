import { version } from '~config';
import * as Sentry from '@sentry/electron/main';

import { getUpdateChannel } from './update-channel';

export function initSentry(): void {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: `polkadot-desktop@${version}`,
    environment: getUpdateChannel(),
    tracesSampleRate: 0.1,
    // Drop the NodeFetch integration: under rolldown/vite bundling, both
    // instrumentation classes it constructs (UndiciInstrumentation and
    // SentryNodeFetchInstrumentation, via @opentelemetry/instrumentation
    // InstrumentationBase) crash on auto-`enable()` with
    // "(intermediate value).enable is not a function". The right fix —
    // externalizing @sentry/electron from the main bundle — isn't viable
    // here because scripts/postbuild.js strips `dependencies` from the
    // packaged app's package.json (we ship a single bundled main.cjs, no
    // node_modules). The customization API below is Sentry-sanctioned; we
    // only lose auto-breadcrumbs for fetch calls in the main process, which
    // this app doesn't make (electron-updater has its own transport).
    integrations: defaults => defaults.filter(i => i.name !== 'NodeFetch'),
  });
}
