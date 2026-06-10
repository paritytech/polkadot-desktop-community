import { type NavigateOptions } from '@tanstack/react-router';

import { pathnameMatchesSegment } from '@/shared/utils';
import { type TabRef } from '@/aggregates/browser-tabs';

export const PRODUCT = 'product';
export const NEW_TAB = 'new-tab';

type Loc = { pathname: string };
type Params = { id?: unknown; route?: unknown };

// The product route segment is everything after `/product/<id>/`, URL-encoded by the
// router (e.g. a `#/map` deeplink becomes `%23%2Fmap`). Decode it back to the deeplink.
const deeplinkFromPathname = (pathname: string, id: string): string => {
  const prefix = `/product/${id}/`;
  if (!pathname.startsWith(prefix)) return '';
  const segment = pathname.slice(prefix.length);
  if (!segment) return '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

// During a TanStack navigation transition `location.pathname` and `params` update on
// different renders — `params.id`/`params.route` briefly still hold the PREVIOUS route's
// values while `pathname` already points at the new one. Trust the id only once the URL
// segment matches `id` (otherwise the route->selection effect would re-materialize a
// just-closed tab), and derive the deeplink from `location.pathname` rather than the
// equally-stale `params.route`. Writing a stale `params.route` back to the tab desyncs a
// hash-routed product's webview src guard and triggers an infinite reload loop when the
// product navigates between routes (e.g. #/ <-> #/map).
export const productRef = (location: Loc, params: Params): TabRef | null => {
  if (typeof params.id !== 'string' || !pathnameMatchesSegment(location.pathname, `/product/${params.id}`)) return null;
  return { id: params.id, type: PRODUCT, deeplink: deeplinkFromPathname(location.pathname, params.id) };
};

export const newTabRef = (location: Loc, params: Params): TabRef | null => {
  if (typeof params.id !== 'string' || !pathnameMatchesSegment(location.pathname, `/new-tab/${params.id}`)) return null;
  return { id: params.id, type: NEW_TAB, deeplink: '' };
};

export const toBrowserNavigation = (tab: TabRef): NavigateOptions => {
  if (tab.type === NEW_TAB) {
    return { to: '/new-tab/$id', params: { id: tab.id } };
  }
  return { to: '/product/$id/{-$route}', params: { id: tab.id, route: tab.deeplink } };
};
