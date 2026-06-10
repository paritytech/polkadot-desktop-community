import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { webviewRegistry } from './registry';

function freshRegistry() {
  // The registry is a module singleton; reset it between tests by unregistering everything
  // (which also clears any crashes attached to those ids) and then dropping any orphaned
  // crash/unresponsive entries that were attached without a corresponding register.
  for (const id of Object.keys(webviewRegistry.ids$.get())) {
    webviewRegistry.unregister(id);
  }
  for (const wcid of Object.keys(webviewRegistry.crashes$.get())) {
    webviewRegistry.clearCrash(Number(wcid));
  }
  for (const wcid of Object.keys(webviewRegistry.unresponsive$.get())) {
    webviewRegistry.clearUnresponsive(Number(wcid));
  }
}

describe('webviewRegistry', () => {
  it('registers an id under its identifier', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 1);
    expect(webviewRegistry.ids$.get()).toEqual({ 'app.dot': 1 });
  });

  it('overwrites the id when the same identifier is registered twice', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 1);
    webviewRegistry.register('app.dot', 2);
    expect(webviewRegistry.ids$.get()).toEqual({ 'app.dot': 2 });
  });

  it('keeps independent identifiers separate', () => {
    freshRegistry();
    webviewRegistry.register('a.dot', 1);
    webviewRegistry.register('b.dot', 2);
    expect(webviewRegistry.ids$.get()).toEqual({ 'a.dot': 1, 'b.dot': 2 });
  });

  it('removes an entry on unregister', () => {
    freshRegistry();
    webviewRegistry.register('a.dot', 1);
    webviewRegistry.unregister('a.dot');
    expect(webviewRegistry.ids$.get()).toEqual({});
  });

  it('is a no-op when unregistering an unknown identifier (returns prev reference)', () => {
    freshRegistry();
    webviewRegistry.register('a.dot', 1);
    const before = webviewRegistry.ids$.get();
    webviewRegistry.unregister('does-not-exist');
    const after = webviewRegistry.ids$.get();
    expect(after).toBe(before); // reference equality proves the early-return guard
  });

  it('emits each consistent state to subscribers', async () => {
    freshRegistry();
    const emissions = firstValueFrom(webviewRegistry.ids$.value$.pipe(take(4), toArray()));
    webviewRegistry.register('a.dot', 1);
    webviewRegistry.register('b.dot', 2);
    webviewRegistry.unregister('a.dot');
    const seen = await emissions;
    expect(seen).toEqual([{}, { 'a.dot': 1 }, { 'a.dot': 1, 'b.dot': 2 }, { 'b.dot': 2 }]);
  });
});

describe('webviewRegistry — crashes$', () => {
  it('starts empty', () => {
    freshRegistry();
    expect(webviewRegistry.crashes$.get()).toEqual({});
  });

  it('markCrashed adds a crash entry keyed by webContentsId', () => {
    freshRegistry();
    webviewRegistry.markCrashed({
      webContentsId: 7,
      url: 'polkadot://x.dot/',
      reason: 'oom',
      exitCode: 5,
      at: 1700000000000,
    });
    expect(webviewRegistry.crashes$.get()).toEqual({
      7: { webContentsId: 7, url: 'polkadot://x.dot/', reason: 'oom', exitCode: 5, at: 1700000000000 },
    });
  });

  it('markCrashed for a different webContentsId does not overwrite an existing one', () => {
    freshRegistry();
    webviewRegistry.markCrashed({ webContentsId: 1, url: 'a', reason: 'oom', exitCode: 5, at: 1 });
    webviewRegistry.markCrashed({ webContentsId: 2, url: 'b', reason: 'crashed', exitCode: 3, at: 2 });
    expect(webviewRegistry.crashes$.get()).toEqual({
      1: { webContentsId: 1, url: 'a', reason: 'oom', exitCode: 5, at: 1 },
      2: { webContentsId: 2, url: 'b', reason: 'crashed', exitCode: 3, at: 2 },
    });
  });

  it('clearCrash removes a crash entry', () => {
    freshRegistry();
    webviewRegistry.markCrashed({ webContentsId: 7, url: 'a', reason: 'crashed', exitCode: 1, at: 1 });
    webviewRegistry.clearCrash(7);
    expect(webviewRegistry.crashes$.get()).toEqual({});
  });

  it('clearCrash is a no-op for an unknown webContentsId (returns prev reference)', () => {
    freshRegistry();
    webviewRegistry.markCrashed({ webContentsId: 7, url: 'a', reason: 'crashed', exitCode: 1, at: 1 });
    const before = webviewRegistry.crashes$.get();
    webviewRegistry.clearCrash(999);
    const after = webviewRegistry.crashes$.get();
    expect(after).toBe(before);
  });

  it('register clears a previous crash for the same identifier when it gets a new id', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 1);
    webviewRegistry.markCrashed({ webContentsId: 1, url: 'a', reason: 'oom', exitCode: 5, at: 1 });
    webviewRegistry.register('app.dot', 2); // fresh dom-ready, fresh process
    expect(webviewRegistry.crashes$.get()).toEqual({});
  });

  it('register clears a stale crash recorded against the new webContentsId', () => {
    // Edge case: a crash event for id=2 arrives after the OS recycled it; later
    // a brand new webview registers under id=2. The fresh process must not be
    // shown as crashed.
    freshRegistry();
    webviewRegistry.markCrashed({ webContentsId: 2, url: 'old', reason: 'oom', exitCode: 5, at: 1 });
    webviewRegistry.register('app.dot', 2);
    expect(webviewRegistry.crashes$.get()).toEqual({});
  });

  it('unregister clears the crash entry for the released webContentsId', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 9);
    webviewRegistry.markCrashed({ webContentsId: 9, url: 'a', reason: 'oom', exitCode: 5, at: 1 });
    webviewRegistry.unregister('app.dot');
    expect(webviewRegistry.crashes$.get()).toEqual({});
  });

  it('keeps unrelated crash entries when one identifier is unregistered', () => {
    freshRegistry();
    webviewRegistry.register('a.dot', 1);
    webviewRegistry.register('b.dot', 2);
    webviewRegistry.markCrashed({ webContentsId: 1, url: 'a', reason: 'oom', exitCode: 5, at: 1 });
    webviewRegistry.markCrashed({ webContentsId: 2, url: 'b', reason: 'crashed', exitCode: 5, at: 2 });
    webviewRegistry.unregister('a.dot');
    expect(webviewRegistry.crashes$.get()).toEqual({
      2: { webContentsId: 2, url: 'b', reason: 'crashed', exitCode: 5, at: 2 },
    });
  });
});

describe('webviewRegistry — unresponsive$', () => {
  it('starts empty', () => {
    freshRegistry();
    expect(webviewRegistry.unresponsive$.get()).toEqual({});
  });

  it('markUnresponsive adds an entry keyed by webContentsId', () => {
    freshRegistry();
    webviewRegistry.markUnresponsive({ webContentsId: 7, url: 'polkadot://x.dot/', at: 1700000000000 });
    expect(webviewRegistry.unresponsive$.get()).toEqual({
      7: { webContentsId: 7, url: 'polkadot://x.dot/', at: 1700000000000 },
    });
  });

  it('clearUnresponsive removes the entry', () => {
    freshRegistry();
    webviewRegistry.markUnresponsive({ webContentsId: 7, url: 'a', at: 1 });
    webviewRegistry.clearUnresponsive(7);
    expect(webviewRegistry.unresponsive$.get()).toEqual({});
  });

  it('register clears stale unresponsive state for the new webContentsId', () => {
    freshRegistry();
    webviewRegistry.markUnresponsive({ webContentsId: 2, url: 'old', at: 1 });
    webviewRegistry.register('app.dot', 2);
    expect(webviewRegistry.unresponsive$.get()).toEqual({});
  });

  it('register clears unresponsive state from the prior id when an identifier rebinds', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 1);
    webviewRegistry.markUnresponsive({ webContentsId: 1, url: 'a', at: 1 });
    webviewRegistry.register('app.dot', 2);
    expect(webviewRegistry.unresponsive$.get()).toEqual({});
  });

  it('unregister clears unresponsive state for the released webContentsId', () => {
    freshRegistry();
    webviewRegistry.register('app.dot', 9);
    webviewRegistry.markUnresponsive({ webContentsId: 9, url: 'a', at: 1 });
    webviewRegistry.unregister('app.dot');
    expect(webviewRegistry.unresponsive$.get()).toEqual({});
  });
});
