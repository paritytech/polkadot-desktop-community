// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { dotNsService } from '@/domains/product';

import { decideDidNavigate, decideDidNavigateInPage, decideWillNavigate } from './navigation';

function parsed(url: string) {
  const r = dotNsService.parseDotNsDomain(url);
  if (!r) throw new Error(`fixture: cannot parse ${url}`);
  return r;
}

describe('decideWillNavigate', () => {
  it('allows non-dotNs URLs', () => {
    expect(decideWillNavigate({ url: 'https://example.com/x', identifier: 'app.dot', localhost: false })).toEqual({
      type: 'allow',
    });
  });

  it('syncs and tracks pathname for same-product polkadot://', () => {
    expect(decideWillNavigate({ url: 'polkadot://app.dot/page', identifier: 'app.dot', localhost: false })).toEqual({
      type: 'sync-pathname',
      pathname: 'page',
      track: true,
    });
  });

  it('cross-product polkadot:// → cross-product with stop:true', () => {
    expect(decideWillNavigate({ url: 'polkadot://other.dot/x', identifier: 'app.dot', localhost: false })).toEqual({
      type: 'cross-product',
      target: parsed('polkadot://other.dot/x'),
      stop: true,
    });
  });

  it('legacy nested encoding (polkadot://this/polkadot://other/...) → cross-product, stop:false', () => {
    const url = 'polkadot://app.dot/polkadot://other.dot/x';
    expect(decideWillNavigate({ url, identifier: 'app.dot', localhost: false })).toEqual({
      type: 'cross-product',
      target: parsed('polkadot://other.dot/x'),
      stop: false,
    });
  });

  it('same-product nested encoding still triggers cross-product (stop:false)', () => {
    const url = 'polkadot://app.dot/polkadot://app.dot/x';
    expect(decideWillNavigate({ url, identifier: 'app.dot', localhost: false })).toEqual({
      type: 'cross-product',
      target: parsed('polkadot://app.dot/x'),
      stop: false,
    });
  });

  it('parsed but not dotDomain and not sameLocalhost → allow', () => {
    expect(decideWillNavigate({ url: 'polkadot://other.NOT-dot/x', identifier: 'app.dot', localhost: false })).toEqual({
      type: 'allow',
    });
  });

  it('http://localhost/x in localhost mode → sync-pathname track:false', () => {
    expect(decideWillNavigate({ url: 'http://localhost:5173/page', identifier: 'localhost:5173', localhost: true })).toEqual({
      type: 'sync-pathname',
      pathname: 'page',
      track: false,
    });
  });

  it('http://localhost/x with non-localhost identifier → allow', () => {
    expect(decideWillNavigate({ url: 'http://localhost:5173/page', identifier: 'app.dot', localhost: false })).toEqual({
      type: 'allow',
    });
  });

  it('garbage / empty inputs → allow', () => {
    expect(decideWillNavigate({ url: '', identifier: 'app.dot', localhost: false })).toEqual({ type: 'allow' });
    expect(decideWillNavigate({ url: 'not-a-url', identifier: 'app.dot', localhost: false })).toEqual({ type: 'allow' });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://example.com/abc',
    'file:///etc/passwd',
  ])('rejects dangerous scheme %s', url => {
    expect(decideWillNavigate({ url, identifier: 'app.dot', localhost: false })).toEqual({ type: 'deny' });
  });
});

describe('decideDidNavigate', () => {
  it('allows non-polkadot URLs', () => {
    expect(decideDidNavigate({ url: 'https://example.com/x', identifier: 'app.dot' })).toEqual({ type: 'allow' });
  });

  it('allows same-product polkadot URL', () => {
    expect(decideDidNavigate({ url: 'polkadot://app.dot/x', identifier: 'app.dot' })).toEqual({ type: 'allow' });
  });

  it('reverts when committed to a cross-product URL (race loss)', () => {
    expect(decideDidNavigate({ url: 'polkadot://other.dot/x', identifier: 'app.dot' })).toEqual({
      type: 'revert-to-desired',
    });
  });

  it('reverts when committed to legacy-nested cross-product URL', () => {
    expect(decideDidNavigate({ url: 'polkadot://app.dot/polkadot://other.dot/x', identifier: 'app.dot' })).toEqual({
      type: 'revert-to-desired',
    });
  });

  it('allows when polkadot URL fails to parse', () => {
    expect(decideDidNavigate({ url: 'polkadot://', identifier: 'app.dot' })).toEqual({ type: 'allow' });
  });
});

describe('decideDidNavigateInPage', () => {
  it('syncs and tracks pathname on same-product main-frame SPA nav', () => {
    expect(
      decideDidNavigateInPage({ url: 'polkadot://app.dot/new', identifier: 'app.dot', localhost: false, isMainFrame: true }),
    ).toEqual({ type: 'sync-pathname', pathname: 'new', track: true });
  });

  it('ignores cross-product SPA nav (no dispatch)', () => {
    expect(
      decideDidNavigateInPage({ url: 'polkadot://other.dot/new', identifier: 'app.dot', localhost: false, isMainFrame: true }),
    ).toEqual({ type: 'allow' });
  });

  it('ignores subframe navigations', () => {
    expect(
      decideDidNavigateInPage({ url: 'polkadot://app.dot/new', identifier: 'app.dot', localhost: false, isMainFrame: false }),
    ).toEqual({ type: 'allow' });
  });

  it('ignores non-dotNs URLs', () => {
    expect(
      decideDidNavigateInPage({ url: 'https://example.com/x', identifier: 'app.dot', localhost: false, isMainFrame: true }),
    ).toEqual({ type: 'allow' });
  });

  it('handles localhost identifier same-product', () => {
    expect(
      decideDidNavigateInPage({
        url: 'http://localhost:5173/new',
        identifier: 'localhost:5173',
        localhost: true,
        isMainFrame: true,
      }),
    ).toEqual({ type: 'sync-pathname', pathname: 'new', track: true });
  });
});
