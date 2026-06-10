import { describe, expect, it } from 'vitest';

import { NEW_TAB, PRODUCT, newTabRef, productRef, toBrowserNavigation } from './helpers';

describe('productRef', () => {
  it('maps a /product/ location to a product ref', () => {
    expect(productRef({ pathname: '/product/foo.dot/swap' }, { id: 'foo.dot', route: 'swap' })).toEqual({
      id: 'foo.dot',
      type: PRODUCT,
      deeplink: 'swap',
    });
  });
  it('returns null off a product route', () => {
    expect(productRef({ pathname: '/dashboard' }, {})).toBeNull();
  });
  // Mid-navigation params.id lags location.pathname; trusting it would re-materialize
  // the previous product (the just-closed tab). The segment must match params.id.
  it('returns null when params.id disagrees with the pathname segment', () => {
    expect(productRef({ pathname: '/product/aaa' }, { id: 'bbb' })).toBeNull();
  });
  it('does not segment-mismatch on a shared id prefix', () => {
    expect(productRef({ pathname: '/product/foobar' }, { id: 'foo' })).toBeNull();
  });

  it('decodes the deeplink from an encoded hash-route segment', () => {
    expect(productRef({ pathname: '/product/web3summit.dot/%23%2Fmap' }, { id: 'web3summit.dot', route: '#/map' })).toEqual({
      id: 'web3summit.dot',
      type: PRODUCT,
      deeplink: '#/map',
    });
  });

  // During a TanStack navigation transition `params` updates a render later than
  // `location.pathname`. Trusting the stale `params.route` would write a stale deeplink
  // back to the tab, which (for a hash-routed product moving between routes, e.g. #/ <->
  // #/map) desyncs the product webview's src guard and triggers an infinite reload loop.
  // The deeplink must come from the fresher `location.pathname`, not `params.route`.
  it('derives the deeplink from the pathname, ignoring a stale params.route', () => {
    expect(productRef({ pathname: '/product/web3summit.dot/%23%2Fmap' }, { id: 'web3summit.dot', route: '#/' })).toEqual({
      id: 'web3summit.dot',
      type: PRODUCT,
      deeplink: '#/map',
    });
  });

  it('treats a missing route segment as an empty deeplink', () => {
    expect(productRef({ pathname: '/product/foo.dot' }, { id: 'foo.dot', route: 'swap' })).toEqual({
      id: 'foo.dot',
      type: PRODUCT,
      deeplink: '',
    });
  });
});

describe('newTabRef', () => {
  it('maps a /new-tab/ location to a new-tab ref', () => {
    expect(newTabRef({ pathname: '/new-tab/nt-1' }, { id: 'nt-1' })).toEqual({ id: 'nt-1', type: NEW_TAB, deeplink: '' });
  });
  it('returns null off a new-tab route', () => {
    expect(newTabRef({ pathname: '/chat' }, {})).toBeNull();
  });
  it('returns null when params.id disagrees with the pathname segment', () => {
    expect(newTabRef({ pathname: '/new-tab/nt-1' }, { id: 'nt-2' })).toBeNull();
  });
});

describe('toBrowserNavigation', () => {
  it('builds a product nav target', () => {
    expect(toBrowserNavigation({ id: 'foo.dot', type: PRODUCT, deeplink: 'swap' })).toEqual({
      to: '/product/$id/{-$route}',
      params: { id: 'foo.dot', route: 'swap' },
    });
  });
  it('builds a new-tab nav target', () => {
    expect(toBrowserNavigation({ id: 'nt-1', type: NEW_TAB, deeplink: '' })).toEqual({
      to: '/new-tab/$id',
      params: { id: 'nt-1' },
    });
  });
});
