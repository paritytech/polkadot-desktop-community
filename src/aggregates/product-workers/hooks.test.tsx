// @vitest-environment happy-dom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HexString } from '@/shared/types';
import type * as productDomain from '@/domains/product';
import { type Product, type ProductWorkerInstance } from '@/domains/product';

const TEST_HASH = '0xdeadbeef' as HexString;

import { useProductWorker } from './hooks';
import { productWorkerRegistry } from './state/registry';

const { useExecutableArchiveMock, useSessionMock, useProductSessionsMock, createProductWorkerMock } = vi.hoisted(() => ({
  useExecutableArchiveMock: vi.fn(),
  useSessionMock: vi.fn(() => ({ session: null })),
  useProductSessionsMock: vi.fn(() => ({ data: [] })),
  createProductWorkerMock: vi.fn(),
}));

vi.mock('@/domains/product', async importOriginal => {
  const real = await importOriginal<typeof productDomain>();
  return {
    ...real,
    useExecutableArchive: (...args: unknown[]) => useExecutableArchiveMock(...args),
    createProductWorker: (...args: unknown[]) => createProductWorkerMock(...args),
  };
});

vi.mock('@novasamatech/host-papp-react-ui', () => ({ useSession: () => useSessionMock() }));

vi.mock('@/domains/chat', async importOriginal => {
  const real = await importOriginal<Record<string, unknown>>();
  return { ...real, useProductSessions: () => useProductSessionsMock() };
});

const WORKER_ENTRYPOINT = 'index.js';

const product: Product = {
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
      contenthash: TEST_HASH,
    },
  },
};

const content1 = {
  contenthash: 'cid-1',
  archive: { domain: 'worker.a.dot', origin: 'polkadot://worker.a.dot', files: { [WORKER_ENTRYPOINT]: 'CODE-1' } },
};
const content2 = {
  contenthash: 'cid-2',
  archive: { domain: 'worker.a.dot', origin: 'polkadot://worker.a.dot', files: { [WORKER_ENTRYPOINT]: 'CODE-2' } },
};

function fakeInstance(productId: string, contenthash: string): ProductWorkerInstance {
  let disposed = false;
  return {
    productId,
    contenthash,

    sandbox: {} as ProductWorkerInstance['sandbox'],

    container: {} as ProductWorkerInstance['container'],

    events: {} as ProductWorkerInstance['events'],
    get disposed() {
      return disposed;
    },
    dispose: vi.fn(() => {
      disposed = true;
    }),
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const Probe = ({ product: p }: { product: Product }) => {
  useProductWorker(p);
  return null;
};

async function flush() {
  // Two microtask boundaries: one for createProductWorker.then, one for setState.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const id of Object.keys(productWorkerRegistry.instances$.get())) {
    const inst = productWorkerRegistry.get(id);
    if (inst) productWorkerRegistry.unregister(inst);
  }
  useExecutableArchiveMock.mockReturnValue({ data: content1, pending: false, error: null });
});

afterEach(() => {
  cleanup();
});

describe('useProductWorker — lifecycle', () => {
  it('builds, registers, and disposes on unmount', async () => {
    const inst = fakeInstance('a.dot', 'cid-1');
    createProductWorkerMock.mockResolvedValueOnce(inst);

    const { unmount } = render(<Probe product={product} />);
    await flush();

    expect(createProductWorkerMock).toHaveBeenCalledTimes(1);
    expect(productWorkerRegistry.get('a.dot')).toBe(inst);
    expect(inst.dispose).not.toHaveBeenCalled();

    unmount();
    expect(inst.dispose).toHaveBeenCalledTimes(1);
    expect(productWorkerRegistry.get('a.dot')).toBeNull();
  });

  it('archive change disposes the old instance and registers the new one', async () => {
    const inst1 = fakeInstance('a.dot', 'cid-1');
    const inst2 = fakeInstance('a.dot', 'cid-2');
    createProductWorkerMock.mockResolvedValueOnce(inst1).mockResolvedValueOnce(inst2);

    const { rerender } = render(<Probe product={product} />);
    await flush();
    expect(productWorkerRegistry.get('a.dot')).toBe(inst1);

    useExecutableArchiveMock.mockReturnValue({ data: content2, pending: false, error: null });
    rerender(<Probe product={product} />);
    await flush();

    expect(inst1.dispose).toHaveBeenCalledTimes(1);
    expect(productWorkerRegistry.get('a.dot')).toBe(inst2);
    expect(inst2.dispose).not.toHaveBeenCalled();
  });

  it('rapid archive change before first build resolves: in-flight instance self-disposes, only the latest lands', async () => {
    const inst1 = fakeInstance('a.dot', 'cid-1');
    const inst2 = fakeInstance('a.dot', 'cid-2');
    const d1 = deferred<ProductWorkerInstance>();
    const d2 = deferred<ProductWorkerInstance>();
    createProductWorkerMock.mockReturnValueOnce(d1.promise).mockReturnValueOnce(d2.promise);

    const { rerender } = render(<Probe product={product} />);

    // archive changes BEFORE first build resolves
    useExecutableArchiveMock.mockReturnValue({ data: content2, pending: false, error: null });
    rerender(<Probe product={product} />);

    // first build now resolves — its build effect was already cancelled, so
    // the .then() must dispose inst1 and never register/setState.
    await act(async () => {
      d1.resolve(inst1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(inst1.dispose).toHaveBeenCalledTimes(1);
    expect(productWorkerRegistry.get('a.dot')).toBeNull();

    // second build resolves — this one wins.
    await act(async () => {
      d2.resolve(inst2);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(productWorkerRegistry.get('a.dot')).toBe(inst2);
    expect(inst2.dispose).not.toHaveBeenCalled();
  });
});
