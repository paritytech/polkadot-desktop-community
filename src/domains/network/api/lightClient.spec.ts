import { type ChainLifecycle } from '@parity/truapi-provider';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { genesisHash } from '../chain/schemas';
import { type GenesisHash } from '../chain/types';

import { createLifecycleWatches, createLightClientProvider, createLightSpecLoader } from './lightClient';

const A = { genesisHash: '0xaa', url: 'https://spec/a' };
const B = { genesisHash: '0xbb', url: 'https://spec/b' };

const bytesA = new Uint8Array([1]);
const bytesB = new Uint8Array([2]);

function bytesFor(url: string): Uint8Array {
  return url === A.url ? bytesA : bytesB;
}

describe('createLightSpecLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches each spec once when called concurrently', async () => {
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) => Promise.resolve(bytesFor(url)));
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await Promise.all([ensure(), ensure()]);

    expect(fetchLightSpec).toHaveBeenCalledTimes(2);
    expect(fetchLightSpec).toHaveBeenCalledWith(A.url);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
    expect(handle.addLightSpec).toHaveBeenCalledTimes(2);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xaa', bytesA);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xbb', bytesB);
  });

  it('adds the specs that arrived when one fetch fails, and resolves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) =>
      url === B.url ? Promise.reject(new Error('offline')) : Promise.resolve(bytesFor(url)),
    );
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await expect(ensure()).resolves.toBeUndefined();

    expect(handle.addLightSpec).toHaveBeenCalledTimes(1);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xaa', bytesA);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('0xbb');
    expect(warn.mock.calls[0]?.[0]).toContain('https://spec/b');
  });

  it('fetches only the missing spec on the next call', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = { addLightSpec: vi.fn() };
    const fetchLightSpec = vi.fn((url: string) =>
      url === B.url ? Promise.reject(new Error('offline')) : Promise.resolve(bytesFor(url)),
    );
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await ensure();
    fetchLightSpec.mockClear();
    handle.addLightSpec.mockClear();
    fetchLightSpec.mockImplementation((url: string) => Promise.resolve(bytesFor(url)));

    await ensure();

    expect(fetchLightSpec).toHaveBeenCalledTimes(1);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
    expect(handle.addLightSpec).toHaveBeenCalledTimes(1);
    expect(handle.addLightSpec).toHaveBeenCalledWith('0xbb', bytesB);
  });

  it('fetches again a spec the provider refused', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = {
      addLightSpec: vi.fn((genesisHash: string) => {
        if (genesisHash === B.genesisHash) throw new Error('sha256 mismatch');
      }),
    };
    const fetchLightSpec = vi.fn((url: string) => Promise.resolve(bytesFor(url)));
    const ensure = createLightSpecLoader([A, B], handle, fetchLightSpec);

    await ensure();
    fetchLightSpec.mockClear();

    await ensure();

    expect(fetchLightSpec).toHaveBeenCalledTimes(1);
    expect(fetchLightSpec).toHaveBeenCalledWith(B.url);
  });
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function noop() {}

const CHAIN = v.parse(genesisHash, '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3');
const OTHER_CHAIN = v.parse(genesisHash, '0x8c27ddf678c2ae9bef0efebfc485a9309f3d735c6d3fbb8d947afc3ace0e80f4');

function lifecycleAt(at: number): ChainLifecycle {
  return { phase: { kind: 'syncing', at, target: 100 }, peers: 3, health: { kind: 'ok' } };
}

// Each `next()` is a read the spec settles. Awaiting a read after settling it resumes
// the spec only after the watch loop has handled it, since the loop awaited it first.
function createFakeWatch() {
  const reads: Deferred<ChainLifecycle | undefined>[] = [];

  const watch = {
    next: vi.fn(() => {
      const read = deferred<ChainLifecycle | undefined>();
      reads.push(read);

      return read.promise;
    }),
    close: vi.fn(),
  };

  function lastRead(): Deferred<ChainLifecycle | undefined> {
    const read = reads.at(-1);
    if (!read) throw new Error('the watch was never read');

    return read;
  }

  return {
    watch,
    async emit(lifecycle: ChainLifecycle | undefined) {
      const read = lastRead();
      read.resolve(lifecycle);
      await read.promise;
    },
    async fail(error: unknown) {
      const read = lastRead();
      read.reject(error);
      await read.promise.catch(noop);
    },
  };
}

describe('createLifecycleWatches', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts one watch per chain however many connections open it', () => {
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const watchLifecycle = vi.fn(() => fake.watch);

    watches.open(CHAIN, watchLifecycle);
    watches.open(CHAIN, watchLifecycle);

    expect(watchLifecycle).toHaveBeenCalledTimes(1);
  });

  it('hands each state to every listener', async () => {
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const first = vi.fn();
    const second = vi.fn();
    watches.subscribe(first);
    watches.subscribe(second);

    watches.open(CHAIN, () => fake.watch);
    await fake.emit(lifecycleAt(1));
    await fake.emit(lifecycleAt(2));

    for (const listener of [first, second]) {
      expect(listener.mock.calls).toEqual([
        [CHAIN, lifecycleAt(1)],
        [CHAIN, lifecycleAt(2)],
      ]);
    }
  });

  it('replays the latest state of every watched chain to a later listener', async () => {
    const watches = createLifecycleWatches();
    const fakeA = createFakeWatch();
    const fakeB = createFakeWatch();
    watches.open(CHAIN, () => fakeA.watch);
    watches.open(OTHER_CHAIN, () => fakeB.watch);
    await fakeA.emit(lifecycleAt(1));
    await fakeA.emit(lifecycleAt(2));
    await fakeB.emit(lifecycleAt(7));

    const listener = vi.fn();
    watches.subscribe(listener);

    expect(listener.mock.calls).toEqual([
      [CHAIN, lifecycleAt(2)],
      [OTHER_CHAIN, lifecycleAt(7)],
    ]);
  });

  it('closes the watch with the last connection and reports the chain gone when it ends', async () => {
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const listener = vi.fn();
    watches.subscribe(listener);
    watches.open(CHAIN, () => fake.watch);
    watches.open(CHAIN, () => fake.watch);
    await fake.emit(lifecycleAt(1));

    watches.close(CHAIN);
    expect(fake.watch.close).toHaveBeenCalledTimes(0);

    watches.close(CHAIN);
    expect(fake.watch.close).toHaveBeenCalledTimes(1);

    await fake.emit(undefined);
    expect(listener.mock.calls).toEqual([
      [CHAIN, lifecycleAt(1)],
      [CHAIN, null],
    ]);

    const later = vi.fn();
    watches.subscribe(later);
    expect(later).toHaveBeenCalledTimes(0);
  });

  it('reports the chain gone and warns when the watch cannot be opened', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const watches = createLifecycleWatches();
    const listener = vi.fn();
    watches.subscribe(listener);

    watches.open(CHAIN, () => {
      throw new Error('nothing is connected');
    });

    expect(listener.mock.calls).toEqual([[CHAIN, null]]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports the chain gone and warns when a read rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const listener = vi.fn();
    watches.subscribe(listener);
    watches.open(CHAIN, () => fake.watch);
    await fake.emit(lifecycleAt(1));

    await fake.fail(new Error('provider gone'));

    expect(listener.mock.calls).toEqual([
      [CHAIN, lifecycleAt(1)],
      [CHAIN, null],
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('keeps a reopened watch when the closed one ends after it', async () => {
    const watches = createLifecycleWatches();
    const oldFake = createFakeWatch();
    const newFake = createFakeWatch();
    const listener = vi.fn();
    watches.subscribe(listener);
    watches.open(CHAIN, () => oldFake.watch);
    await oldFake.emit(lifecycleAt(1));

    watches.close(CHAIN);
    watches.open(CHAIN, () => newFake.watch);
    await newFake.emit(lifecycleAt(2));
    await oldFake.emit(undefined);
    await newFake.emit(lifecycleAt(3));

    expect(listener.mock.calls).toEqual([
      [CHAIN, lifecycleAt(1)],
      [CHAIN, lifecycleAt(2)],
      [CHAIN, lifecycleAt(3)],
    ]);

    const later = vi.fn();
    watches.subscribe(later);
    expect(later.mock.calls).toEqual([[CHAIN, lifecycleAt(3)]]);
  });

  it('starts a new watch on the next open after one ended while connections stayed open', async () => {
    const watches = createLifecycleWatches();
    const ended = createFakeWatch();
    const next = createFakeWatch();
    const watchLifecycle = vi.fn().mockReturnValueOnce(ended.watch).mockReturnValueOnce(next.watch);
    watches.open(CHAIN, watchLifecycle);
    await ended.emit(undefined);

    watches.open(CHAIN, watchLifecycle);

    expect(watchLifecycle).toHaveBeenCalledTimes(2);
    expect(next.watch.next).toHaveBeenCalledTimes(1);
  });

  it('starts a new watch on the next open after one could not be opened', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const watchLifecycle = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('nothing is connected');
      })
      .mockReturnValueOnce(fake.watch);
    watches.open(CHAIN, watchLifecycle);

    watches.open(CHAIN, watchLifecycle);

    expect(watchLifecycle).toHaveBeenCalledTimes(2);
    expect(fake.watch.next).toHaveBeenCalledTimes(1);
  });

  it('ignores a close for a chain with no open connection', () => {
    const watches = createLifecycleWatches();
    const fake = createFakeWatch();
    const watchLifecycle = vi.fn(() => fake.watch);

    watches.close(CHAIN);
    watches.open(CHAIN, watchLifecycle);
    expect(watchLifecycle).toHaveBeenCalledTimes(1);

    watches.close(CHAIN);
    expect(fake.watch.close).toHaveBeenCalledTimes(1);
  });
});

// `nextResponse()` hands out one read the spec settles; awaiting it after settling
// resumes the spec only after the drain loop has handled it, since the loop awaited it first.
function createFakeConnection() {
  const read = deferred<string | undefined>();
  const reading = deferred<void>();
  const closed = deferred<void>();

  const connection = {
    send: vi.fn(),
    nextResponse: vi.fn(() => {
      reading.resolve();

      return read.promise;
    }),
    close: vi.fn(() => {
      read.resolve(undefined);
      closed.resolve();
    }),
  };

  return {
    connection,
    reading: reading.promise,
    closed: closed.promise,
    async end() {
      read.resolve(undefined);
      await read.promise;
    },
    async fail(error: unknown) {
      read.reject(error);
      await read.promise.catch(noop);
    },
    settled(): Promise<unknown> {
      return read.promise.catch(noop);
    },
  };
}

function createProviderDeps(connect: () => Promise<ReturnType<typeof createFakeConnection>['connection']>) {
  const lifecycleWatch = createFakeWatch().watch;
  const handle = {
    loadDatabase: vi.fn(() => Promise.resolve(true)),
    connect: vi.fn(connect),
    lifecycle: vi.fn(() => lifecycleWatch),
  };
  const lifecycleWatches = {
    open: vi.fn<(chainId: GenesisHash, watchLifecycle: () => unknown) => void>(),
    close: vi.fn(),
    subscribe: vi.fn(),
  };

  return {
    handle,
    lifecycleWatches,
    deps: {
      getHandle: () => Promise.resolve(handle),
      loadLightSpecs: () => Promise.resolve(),
      lifecycleWatches,
    },
  };
}

describe('createLightClientProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a lifecycle watch on the chain once the connection is up', async () => {
    const fake = createFakeConnection();
    const { handle, lifecycleWatches, deps } = createProviderDeps(() => Promise.resolve(fake.connection));
    const onStatusChanged = vi.fn();

    createLightClientProvider(CHAIN, onStatusChanged, vi.fn(), deps)(vi.fn());
    await fake.reading;

    expect(onStatusChanged).toHaveBeenLastCalledWith('connected');
    expect(lifecycleWatches.open).toHaveBeenCalledTimes(1);
    expect(lifecycleWatches.open).toHaveBeenCalledWith(CHAIN, expect.any(Function));
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(0);

    lifecycleWatches.open.mock.calls[0]?.[1]();
    expect(handle.lifecycle).toHaveBeenCalledWith(CHAIN);
  });

  it('closes the watch once when disconnected and the drain loop then ends', async () => {
    const fake = createFakeConnection();
    const { lifecycleWatches, deps } = createProviderDeps(() => Promise.resolve(fake.connection));
    const onHalt = vi.fn();

    const connection = createLightClientProvider(CHAIN, vi.fn(), onHalt, deps)(vi.fn());
    await fake.reading;
    connection.disconnect();
    await fake.settled();

    expect(lifecycleWatches.open).toHaveBeenCalledTimes(1);
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(1);
    expect(lifecycleWatches.close).toHaveBeenCalledWith(CHAIN);
    expect(onHalt).toHaveBeenCalledTimes(0);
  });

  it('closes the watch once and halts when a read rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fake = createFakeConnection();
    const { lifecycleWatches, deps } = createProviderDeps(() => Promise.resolve(fake.connection));
    const onHalt = vi.fn();
    const error = new Error('transport died');

    createLightClientProvider(CHAIN, vi.fn(), onHalt, deps)(vi.fn());
    await fake.reading;
    await fake.fail(error);

    expect(lifecycleWatches.open).toHaveBeenCalledTimes(1);
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(1);
    expect(onHalt).toHaveBeenCalledWith(error);
  });

  it('closes the watch once when the drain loop ends on its own', async () => {
    const fake = createFakeConnection();
    const { lifecycleWatches, deps } = createProviderDeps(() => Promise.resolve(fake.connection));
    const onHalt = vi.fn();

    createLightClientProvider(CHAIN, vi.fn(), onHalt, deps)(vi.fn());
    await fake.reading;
    await fake.end();

    expect(lifecycleWatches.open).toHaveBeenCalledTimes(1);
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(1);
    expect(onHalt).toHaveBeenCalledTimes(1);
  });

  it('neither opens nor closes a watch when the connect rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { lifecycleWatches, deps } = createProviderDeps(() => Promise.reject(new Error('connection cap')));
    const halted = deferred<void>();

    createLightClientProvider(CHAIN, vi.fn(), () => halted.resolve(), deps)(vi.fn());
    await halted.promise;

    expect(lifecycleWatches.open).toHaveBeenCalledTimes(0);
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(0);
  });

  it('neither opens nor closes a watch when disconnected before the connect resolves', async () => {
    const fake = createFakeConnection();
    const connectCalled = deferred<void>();
    const connecting = deferred<typeof fake.connection>();
    const { lifecycleWatches, deps } = createProviderDeps(() => {
      connectCalled.resolve();

      return connecting.promise;
    });

    const connection = createLightClientProvider(CHAIN, vi.fn(), vi.fn(), deps)(vi.fn());
    await connectCalled.promise;
    connection.disconnect();
    connecting.resolve(fake.connection);
    await fake.closed;

    expect(lifecycleWatches.open).toHaveBeenCalledTimes(0);
    expect(lifecycleWatches.close).toHaveBeenCalledTimes(0);
  });
});
