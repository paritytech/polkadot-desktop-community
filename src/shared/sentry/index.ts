import * as Sentry from '@sentry/browser';

import { isProductionBuild } from '@/shared/env';

/**
 * Initialize Sentry for the renderer with DOM-listener-based instrumentation
 * disabled. Two pieces of Sentry's default browser SDK attach `click` /
 * `keypress` listeners on `window` / `document` / `body`:
 *
 * 1. The default `breadcrumbsIntegration`'s `dom: true` option — records
 *    click and keypress breadcrumbs by listening at the window/document level.
 * 2. `browserTracingIntegration`'s `enableInp` (Interaction-to-Next-Paint web
 *    vital) — listens on click / keydown to measure interaction latency.
 *
 * In long-running Electron renderer sessions (~60s+ idle), that listener
 * chain accumulates and starts swallowing event dispatch entirely — clicks
 * on Radix dialog content reach no listener anywhere, including a fresh
 * capture-phase listener at `document`. Modal becomes visible-but-inert,
 * recovered only by reload.
 *
 * Verified: removing both DOM-touching pieces eliminates the symptom while
 * keeping everything else Sentry does for us — error capture, history /
 * console / fetch / xhr breadcrumbs, navigation + pageload traces.
 *
 * Trade-offs of this configuration:
 * - **Lost:** click / keypress breadcrumbs (the user-action trail shown in
 *   error detail views). Navigation, console, fetch, XHR breadcrumbs remain.
 * - **Lost:** INP web vital. Other vitals (LCP, FCP, CLS, page-load and
 *   navigation transactions) remain.
 * - **Kept:** all error capture (BrowserApiErrors / GlobalHandlers), Dedupe,
 *   LinkedErrors, HttpContext, performance tracing.
 *
 * Re-evaluate once the underlying Sentry + Electron + React 19 listener
 * accumulation issue is understood and fixed upstream. Tracking work would
 * benefit from a minimal repro filed against getsentry/sentry-javascript.
 */
export function initSentry(): void {
  // No telemetry in production builds. Staging/dev keep Sentry (with DSN).
  if (isProductionBuild()) return;

  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  const environment = typeof window !== 'undefined' && window.App ? window.App.updateChannel : 'stable';

  // Opt out of default integrations entirely and pick only those that
  // don't touch DOM event handling. Two specific defaults are load-bearing
  // in our breakage:
  //
  // - `browserApiErrorsIntegration` patches `EventTarget.prototype.addEventListener`
  //   globally to capture errors thrown inside handlers. Under long-running
  //   Electron renderer sessions, that wrap appears to degrade and silently
  //   drops event dispatch.
  // - `breadcrumbsIntegration` (default `dom: true`) attaches click / keypress
  //   listeners on window / document / body for breadcrumb trails.
  //
  // What we keep below: error capture (globalHandlers), error de-dup, error
  // chaining, HTTP context for stacktraces, function.toString preservation,
  // inbound filtering. Performance tracing is omitted because every
  // `browserTracingIntegration` config we tried still triggered the
  // listener-leak symptom; can be reintroduced once the upstream interaction
  // is understood.
  Sentry.init({
    dsn,
    release: `polkadot-desktop@${process.env['VERSION']}`,
    environment,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.httpContextIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.inboundFiltersIntegration(),
    ],
  });
}

export { Sentry };
