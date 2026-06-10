import { filter, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type PendingRemotePermissionRequest,
  _resetRemotePermissionBroker,
  pendingRemotePermissionRequests$,
  requestExternalUrlAccess,
} from './broker';

describe('requestExternalUrlAccess', () => {
  beforeEach(() => {
    _resetRemotePermissionBroker();
  });

  it('emits a pending request carrying the url origin as the pattern to persist', async () => {
    const pendingPromise = firstValueFrom(pendingRemotePermissionRequests$.pipe(filter(list => list.length > 0)));

    void requestExternalUrlAccess({
      productId: 'pr239.parity.dot',
      url: 'https://storage.googleapis.com/parity-io/image.png',
      modality: 'app',
    });

    const pending = await pendingPromise;
    const first = pending[0];

    expect(pending).toHaveLength(1);
    expect(first?.productId).toBe('pr239.parity.dot');
    expect(first?.origin).toBe('https://storage.googleapis.com');
    expect(first?.url).toBe('https://storage.googleapis.com/parity-io/image.png');
  });

  it('resolves with the status returned by the UI host', async () => {
    const pendingPromise = firstValueFrom(pendingRemotePermissionRequests$.pipe(filter(list => list.length > 0)));
    const decision = requestExternalUrlAccess({
      productId: 'app.dot',
      url: 'https://cdn.example.com/logo.svg',
      modality: 'app',
    });

    const [first] = await pendingPromise;
    first?.resolve('granted');

    await expect(decision).resolves.toBe('granted');
  });

  it('coalesces concurrent requests for the same product+origin into a single prompt', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    const a = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/a.png', modality: 'app' });
    const b = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/b.png', modality: 'app' });
    const c = requestExternalUrlAccess({
      productId: 'p.dot',
      url: 'https://cdn.example.com/deep/path/c.png',
      modality: 'app',
    });

    await Promise.resolve();

    const currentList = emitted.at(-1) ?? [];
    expect(currentList).toHaveLength(1);

    currentList[0]?.resolve('granted');

    await expect(Promise.all([a, b, c])).resolves.toEqual(['granted', 'granted', 'granted']);

    sub.unsubscribe();
  });

  it('does NOT coalesce requests to different origins', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    void requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn-a.example.com/x.png', modality: 'app' });
    void requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn-b.example.com/x.png', modality: 'app' });

    await Promise.resolve();

    const currentList = emitted.at(-1) ?? [];
    expect(currentList).toHaveLength(2);

    sub.unsubscribe();
  });

  it('does NOT coalesce requests across different products', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    void requestExternalUrlAccess({ productId: 'a.dot', url: 'https://cdn.example.com/x.png', modality: 'app' });
    void requestExternalUrlAccess({ productId: 'b.dot', url: 'https://cdn.example.com/x.png', modality: 'app' });

    await Promise.resolve();

    const currentList = emitted.at(-1) ?? [];
    expect(currentList).toHaveLength(2);

    sub.unsubscribe();
  });

  it('removes the request from the pending list once resolved', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    const decision = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/x.png', modality: 'app' });
    await Promise.resolve();

    const pending = emitted.at(-1) ?? [];
    pending[0]?.resolve('denied');

    await decision;

    expect(emitted.at(-1)).toEqual([]);
    sub.unsubscribe();
  });

  it('allows a second prompt for the same origin after the first is resolved', async () => {
    let currentList: PendingRemotePermissionRequest[] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => {
      currentList = list;
    });

    const first = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/a.png', modality: 'app' });
    await Promise.resolve();
    currentList[0]?.resolve('denied');
    await first;

    const second = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/b.png', modality: 'app' });
    await Promise.resolve();

    expect(currentList).toHaveLength(1);
    currentList[0]?.resolve('granted');
    await expect(second).resolves.toBe('granted');

    sub.unsubscribe();
  });

  it('auto-denies malformed URLs without prompting the user', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    await expect(requestExternalUrlAccess({ productId: 'p.dot', url: 'not a url', modality: 'app' })).resolves.toBe('denied');

    expect(emitted.every(list => list.length === 0)).toBe(true);
    sub.unsubscribe();
  });

  it('auto-denies schemes outside the http/https/ws/wss set without prompting', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    await expect(requestExternalUrlAccess({ productId: 'p.dot', url: 'file:///etc/passwd', modality: 'app' })).resolves.toBe(
      'denied',
    );

    expect(emitted.every(list => list.length === 0)).toBe(true);
    sub.unsubscribe();
  });

  it('emits a pending request for wss URLs with the wss origin as the pattern', async () => {
    const pendingPromise = firstValueFrom(pendingRemotePermissionRequests$.pipe(filter(list => list.length > 0)));

    void requestExternalUrlAccess({
      productId: 'p.dot',
      url: 'wss://rpc.polkadot.io/path',
      modality: 'app',
    });

    const [first] = await pendingPromise;

    expect(first?.origin).toBe('wss://rpc.polkadot.io');
    expect(first?.url).toBe('wss://rpc.polkadot.io/path');
  });

  it('treats wss and https as distinct origins (no coalescing across schemes)', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    void requestExternalUrlAccess({ productId: 'p.dot', url: 'wss://rpc.example.com/a', modality: 'app' });
    void requestExternalUrlAccess({ productId: 'p.dot', url: 'https://rpc.example.com/a', modality: 'app' });

    await Promise.resolve();

    const currentList = emitted.at(-1) ?? [];
    expect(currentList).toHaveLength(2);
    expect(currentList.map(r => r.origin).sort()).toEqual(['https://rpc.example.com', 'wss://rpc.example.com']);

    sub.unsubscribe();
  });

  it('does not coalesce requests for the same origin from different modalities', async () => {
    const first = requestExternalUrlAccess({ productId: 'x.dot', url: 'https://api.example.com/a', modality: 'app' });
    const second = requestExternalUrlAccess({ productId: 'x.dot', url: 'https://api.example.com/b', modality: 'widget' });

    const pending = await firstValueFrom(pendingRemotePermissionRequests$);
    expect(pending).toHaveLength(2);
    expect(pending[0]?.modality).toBe('app');
    expect(pending[1]?.modality).toBe('widget');

    pending[0]?.resolve('granted');
    pending[1]?.resolve('denied');
    await expect(first).resolves.toBe('granted');
    await expect(second).resolves.toBe('denied');
  });

  it('includes the port in the origin so different ports are treated as distinct', async () => {
    const emitted: PendingRemotePermissionRequest[][] = [];
    const sub = pendingRemotePermissionRequests$.subscribe(list => emitted.push(list));

    void requestExternalUrlAccess({ productId: 'p.dot', url: 'https://api.example.com:8443/a', modality: 'app' });
    void requestExternalUrlAccess({ productId: 'p.dot', url: 'https://api.example.com:9443/a', modality: 'app' });

    await Promise.resolve();

    const currentList = emitted.at(-1) ?? [];
    expect(currentList).toHaveLength(2);
    expect(currentList.map(r => r.origin).sort()).toEqual(['https://api.example.com:8443', 'https://api.example.com:9443']);

    sub.unsubscribe();
  });
});
