import { type Container } from '@novasamatech/host-container';
import { type Sandbox } from '@novasamatech/host-worker-sandbox';
import { describe, expect, it, vi } from 'vitest';

import { createProductWorker } from './instance';
import { type Binding, type WorkerDeps } from './types';

function makeFakeSandbox(
  overrides: Partial<{
    disposeImpl: () => void;
    containerDisposeImpl: () => void;
  }> = {},
) {
  const containerDispose = vi.fn(overrides.containerDisposeImpl ?? (() => {}));
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const container = { dispose: containerDispose } as unknown as Container;
  const sandboxDispose = vi.fn(overrides.disposeImpl ?? (() => {}));
  let runResolveFn: (() => void) | null = null;
  let runRejectFn: ((e: unknown) => void) | null = null;
  const run = vi.fn(
    () =>
      new Promise<void>((res, rej) => {
        runResolveFn = res;
        runRejectFn = rej;
      }),
  );

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const sandbox = { container, dispose: sandboxDispose, run } as unknown as Sandbox;

  return {
    sandbox,
    sandboxDispose,
    containerDispose,
    run,
    resolveRun: () => runResolveFn?.(),
    rejectRun: (e: unknown) => runRejectFn?.(e),
  };
}

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const noopDeps = {} as WorkerDeps;

const enc = (src: string) => new TextEncoder().encode(src);
// Worker code now lives in the archive; the factory resolves the entrypoint from it.
const archive = (src = '') => ({ files: { 'index.js': enc(src) }, entrypoint: 'index.js' });

describe('createProductWorker', () => {
  it('builds an instance with the expected identifying fields', async () => {
    const fake = makeFakeSandbox();
    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      bindings: [],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    expect(inst.productId).toBe('a.dot');
    expect(inst.contenthash).toBe('cid-1');
    expect(inst.sandbox).toBe(fake.sandbox);
    expect(inst.container).toBe(fake.sandbox.container);
    expect(inst.disposed).toBe(false);
  });

  it('calls each binding once, passing the instance and deps', async () => {
    const fake = makeFakeSandbox();
    const a = vi.fn(() => () => {});
    const b = vi.fn(() => () => {});

    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      bindings: [a as Binding, b as Binding],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith(inst, noopDeps);
    expect(b).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith(inst, noopDeps);
  });

  it('starts run() but does not await it', async () => {
    const fake = makeFakeSandbox();
    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive('CODE'),
      deps: noopDeps,
      bindings: [],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    expect(fake.run).toHaveBeenCalledTimes(1);
    expect(fake.run).toHaveBeenCalledWith(enc('CODE'), { name: 'index.js' });
    expect(inst.disposed).toBe(false);
  });

  it('dispose() runs in order: emitter cleared → bindings → container → sandbox', async () => {
    const fake = makeFakeSandbox();
    const order: string[] = [];

    const binding: Binding = inst => {
      return () => {
        order.push(`binding-cleanup events.events=${JSON.stringify(inst.events.events)}`);
      };
    };
    fake.containerDispose.mockImplementation(() => {
      order.push('container.dispose');
    });
    fake.sandboxDispose.mockImplementation(() => {
      order.push('sandbox.dispose');
    });

    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      bindings: [binding],
      createSandbox: vi.fn(async () => fake.sandbox),
    });
    inst.events.on('sendChatAction', () => {});

    inst.dispose();

    expect(order).toEqual(['binding-cleanup events.events={}', 'container.dispose', 'sandbox.dispose']);
    expect(inst.disposed).toBe(true);
  });

  it('dispose() is idempotent', async () => {
    const fake = makeFakeSandbox();
    const cleanup = vi.fn();
    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      bindings: [() => cleanup],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    inst.dispose();
    inst.dispose();
    inst.dispose();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(fake.containerDispose).toHaveBeenCalledTimes(1);
    expect(fake.sandboxDispose).toHaveBeenCalledTimes(1);
  });

  it('dispose() swallows sandbox.dispose() errors', async () => {
    const fake = makeFakeSandbox({
      disposeImpl: () => {
        throw new Error('quickjs abort');
      },
    });
    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      bindings: [],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    expect(() => inst.dispose()).not.toThrow();
    expect(inst.disposed).toBe(true);
  });

  it('a late run() rejection after dispose does not throw out of the factory', async () => {
    const fake = makeFakeSandbox();
    const inst = await createProductWorker({
      productId: 'a.dot',
      contenthash: 'cid-1',
      ...archive(),
      deps: noopDeps,
      bindings: [],
      createSandbox: vi.fn(async () => fake.sandbox),
    });

    inst.dispose();
    fake.rejectRun(new Error('use-after-free'));
    await Promise.resolve();
    expect(inst.disposed).toBe(true);
  });
});
