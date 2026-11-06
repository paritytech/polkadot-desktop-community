import { asProductId } from '@parity/truapi';
import { type PermissionAuthorizationStatus, type WorkerDemandChange } from '@parity/truapi-host';
import { BehaviorSubject, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HexString } from '@/shared/types';
import { environmentUseCase } from '@/domains/application';
import {
  type ExecutableContent,
  type PersistedProduct,
  type Product,
  type ProductWorkerInstance,
  executableArchiveResource,
  productsResource,
  resolveProductUseCase,
} from '@/domains/product';
import { type TruapiHostRuntime, truapiRuntimeUseCase } from '@/aggregates/truapi-runtime';

import { lifecycleUseCase } from './lifecycleUseCase';
import { productWorkersUseCase } from './productWorkersUseCase';

const WORKER_ENTRYPOINT = 'index.js';
const WORKER_HASH: HexString = '0xdeadbeef';
const ARCHIVE_HASH: HexString = '0xc1d1';

function productWithWorker(): Product {
  return {
    baseName: 'a.dot',
    displayName: 'A',
    description: '',
    icon: { cid: '', format: 'png' },
    executables: {
      worker: {
        kind: 'worker',
        identifier: 'worker.a.dot',
        appVersion: [0, 0, 1],
        entrypoint: WORKER_ENTRYPOINT,
        includes: { chat: true, pocket: false },
        contenthash: WORKER_HASH,
      },
    },
  };
}

function committedWithWorker(contenthash: HexString): PersistedProduct {
  const product = productWithWorker();

  return {
    ...product,
    executables: { worker: { ...product.executables.worker!, contenthash } },
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

function productWithoutWorker(): Product {
  return { baseName: 'b.dot', displayName: 'B', description: '', icon: { cid: '', format: 'png' }, executables: {} };
}

const content: ExecutableContent = {
  contenthash: ARCHIVE_HASH,
  archive: {
    domain: 'worker.a.dot',
    origin: 'polkadot://worker.a.dot',
    files: { [WORKER_ENTRYPOINT]: new TextEncoder().encode('CODE') },
  },
};

function fakeInstance(productId: string): ProductWorkerInstance {
  return {
    productId,
    contenthash: 'cid-1',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the demand watcher never touches it
    sandbox: {} as ProductWorkerInstance['sandbox'],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the demand watcher never touches it
    coreProvider: {} as ProductWorkerInstance['coreProvider'],
    disposed: false,
    dispose: vi.fn(),
  };
}

// The core's demand stream, driven by hand.
function fakeRuntime() {
  const listeners: ((change: WorkerDemandChange) => void)[] = [];
  const unsubscribe = vi.fn();

  // Built in full rather than asserted from a partial: the handle is small, and a
  // stub that lies about its shape stops catching a contract change.
  const runtime: TruapiHostRuntime = {
    createProvider: vi.fn(),
    disconnectSession: vi.fn(() => Promise.resolve()),
    cancelPairing: vi.fn(),
    activateStoredSession: vi.fn(() => Promise.resolve()),
    getPermissionAuthorizationStatus: vi.fn((): Promise<PermissionAuthorizationStatus> => Promise.resolve('NotDetermined')),
    getPermissionAuthorizationStatuses: vi.fn((): Promise<PermissionAuthorizationStatus[]> => Promise.resolve([])),
    setPermissionAuthorizationStatus: vi.fn(() => Promise.resolve()),
    getProductSubtreePublicKey: vi.fn(() => Promise.resolve(undefined)),
    acquireWorker: vi.fn(),
    releaseWorker: vi.fn(),
    subscribeWorkerDemand: (listener: (change: WorkerDemandChange) => void) => {
      listeners.push(listener);

      return unsubscribe;
    },
    dispose: vi.fn(),
  };

  return {
    runtime,
    unsubscribe,
    emit: (productId: string, wanted: boolean) => {
      for (const listener of [...listeners]) listener({ productId: asProductId(productId), wanted });
    },
  };
}

// `createInstance$` is the composition boundary: a real one builds a QuickJS sandbox.
// Spied in place so the seam stays the same object production uses.
function stubInstances(): { created: string[]; teardowns: number } {
  const state: { created: string[]; teardowns: number } = { created: [], teardowns: 0 };

  vi.spyOn(lifecycleUseCase, 'createInstance$').mockImplementation(
    ({ getProduct }) =>
      new Observable<ProductWorkerInstance>(subscriber => {
        const productId = getProduct().baseName;
        state.created.push(productId);
        subscriber.next(fakeInstance(productId));

        return () => {
          state.teardowns += 1;
        };
      }),
  );

  return state;
}

let stopWatching: VoidFunction = () => {};

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only the ipfs URL is read here
  vi.spyOn(environmentUseCase, 'getActive').mockResolvedValue({ ipfsGatewayUrl: 'https://ipfs.example' } as never);

  executableArchiveResource.instead(() => content);
});

afterEach(() => {
  stopWatching();
  stopWatching = () => {};
  vi.restoreAllMocks();
});

describe('productWorkersUseCase.watchDemand', () => {
  it('starts a worker when the core reports demand for it', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);

    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));
  });

  // The ledger counts; the host runs at most one worker per product however many
  // references formed.
  it('does not start a second worker while one is already running', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));

    core.emit('a.dot', true);

    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));
  });

  it('disposes the worker when demand drops', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));

    core.emit('a.dot', false);

    await vi.waitFor(() => expect(instances.teardowns).toBe(1));
  });

  // The core can want a worker the host cannot supply — an uninstalled product, or
  // one whose manifest declares none. Nothing to run is not a failure.
  it('starts nothing for a product with no worker executable', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithoutWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('b.dot', true);

    await vi.waitFor(() => expect(resolveProductUseCase.resolveProduct).toHaveBeenCalledWith('b.dot'));
    expect(instances.created).toEqual([]);
  });

  // The bounce `WorkersManager` produces on an account switch: release then acquire
  // while the first start is still awaiting its archive. Both starts resume; only one
  // instance may survive, and the other must be torn down rather than orphaned.
  it('leaves exactly one live worker when demand bounces mid-start', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();

    core.emit('a.dot', true);
    core.emit('a.dot', false);
    core.emit('a.dot', true);

    await vi.waitFor(() => expect(instances.created.length).toBeGreaterThan(0));
    // Whatever the interleaving produced, every instance but the surviving one is torn
    // down — an orphan would keep a QuickJS sandbox and a core provider alive.
    await vi.waitFor(() => expect(instances.teardowns).toBe(instances.created.length - 1));
  });

  // A dead subscription left in the map reads as "running" and swallows every later
  // acquire, so the product can never start again for the rest of the session.
  it('lets a product start again after a failed build', async () => {
    const created: string[] = [];
    let failNext = true;

    vi.spyOn(lifecycleUseCase, 'createInstance$').mockImplementation(
      ({ getProduct }) =>
        new Observable<ProductWorkerInstance>(subscriber => {
          const productId = getProduct().baseName;
          if (failNext) {
            failNext = false;
            subscriber.error(new Error('build failed'));

            return;
          }
          created.push(productId);
          subscriber.next(fakeInstance(productId));
        }),
    );
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();

    core.emit('a.dot', true);
    await vi.waitFor(() => expect(failNext).toBe(false));

    core.emit('a.dot', true);

    await vi.waitFor(() => expect(created).toEqual(['a.dot']));
  });

  // Same failure class as the build error: an early return must not leave the slot
  // claimed, or a transient archive miss wedges the product permanently.
  //
  // Two things this test has to do to have any teeth, both learned the hard way:
  // wait for the archive READ (not merely for the start to have begun) or the
  // override is swapped back before the miss happens and nothing is pinned; and
  // never emit `wanted: false`, because `stop()` releases unconditionally and would
  // hide the very release this is checking. Re-emitting `true` is what a surface
  // declaring demand again looks like, and it only starts a worker if the slot was
  // actually released.
  it('lets a product start again after its archive was unavailable', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    let archiveReads = 0;
    executableArchiveResource.instead(() => {
      archiveReads += 1;

      return null;
    });
    stopWatching = await productWorkersUseCase.watchDemand();

    core.emit('a.dot', true);
    await vi.waitFor(() => expect(archiveReads).toBe(1));
    expect(instances.created).toEqual([]);

    executableArchiveResource.instead(() => content);

    await vi.waitFor(() => {
      core.emit('a.dot', true);
      expect(instances.created).toEqual(['a.dot']);
    });
  });

  // The other early return with the same hazard: a product that resolves without a
  // worker executable must release its slot too, or installing the worker later can
  // never take effect for the rest of the session.
  it('lets a product start once it gains a worker executable', async () => {
    const instances = stubInstances();
    const resolve = vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithoutWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    stopWatching = await productWorkersUseCase.watchDemand();

    core.emit('b.dot', true);
    await vi.waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    expect(instances.created).toEqual([]);

    resolve.mockResolvedValue({ ...productWithWorker(), baseName: 'b.dot' });

    await vi.waitFor(() => {
      core.emit('b.dot', true);
      expect(instances.created).toEqual(['b.dot']);
    });
  });

  // A redeploy rewrites the committed row; the core's demand never drops across one,
  // because `WorkersManager` deliberately keeps a single holder so a commit does not
  // bounce the worker. Without this the product runs its old bytes until relaunch.
  it('restarts a running worker when its product is redeployed', async () => {
    const instances = stubInstances();
    const resolve = vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    const rows = new BehaviorSubject<PersistedProduct[]>([committedWithWorker(WORKER_HASH)]);
    productsResource.instead(() => rows);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));

    const REDEPLOYED: HexString = '0xfeedface';
    resolve.mockResolvedValue({
      ...productWithWorker(),
      executables: { worker: { ...productWithWorker().executables.worker!, contenthash: REDEPLOYED } },
    });
    rows.next([committedWithWorker(REDEPLOYED)]);

    // The old instance is disposed, not left running beside the new one.
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot', 'a.dot']));
    expect(instances.teardowns).toBe(1);
  });

  // The guard against measuring a redeploy by the bytes that were BUILT: when the
  // resolved row lags the observed one, every restart would look stale again.
  it('does not restart repeatedly when the resolved row lags the redeployed one', async () => {
    const instances = stubInstances();
    // Deliberately never updated — the resolve keeps answering with the old bytes.
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    const rows = new BehaviorSubject<PersistedProduct[]>([committedWithWorker(WORKER_HASH)]);
    productsResource.instead(() => rows);

    stopWatching = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));

    rows.next([committedWithWorker('0xfeedface')]);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot', 'a.dot']));

    // Settles at exactly one restart rather than spinning.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(instances.created).toEqual(['a.dot', 'a.dot']);
  });

  it('drops the listener and every running worker on teardown', async () => {
    const instances = stubInstances();
    vi.spyOn(resolveProductUseCase, 'resolveProduct').mockResolvedValue(productWithWorker());
    const core = fakeRuntime();
    vi.spyOn(truapiRuntimeUseCase, 'whenRuntimeReady').mockResolvedValue(core.runtime);

    const stop = await productWorkersUseCase.watchDemand();
    core.emit('a.dot', true);
    await vi.waitFor(() => expect(instances.created).toEqual(['a.dot']));

    stop();

    expect(core.unsubscribe).toHaveBeenCalledOnce();
    expect(instances.teardowns).toBe(1);
  });
});
