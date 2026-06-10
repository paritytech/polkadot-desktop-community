import { firstValueFrom, take, toArray } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import { type ProductWorkerInstance } from '@/domains/product';

import { productWorkerRegistry } from './registry';

function fakeInstance(productId: string): ProductWorkerInstance {
  return {
    productId,
    contenthash: 'cid',
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    container: {} as ProductWorkerInstance['container'],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    events: {} as ProductWorkerInstance['events'],
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    sandbox: {} as ProductWorkerInstance['sandbox'],
    disposed: false,
    dispose: () => {},
  };
}

afterEach(() => {
  for (const id of Object.keys(productWorkerRegistry.instances$.get())) {
    const inst = productWorkerRegistry.get(id);
    if (inst) productWorkerRegistry.unregister(inst);
  }
});

describe('productWorkerRegistry', () => {
  it('register adds the instance under its productId', () => {
    const a = fakeInstance('a.dot');
    productWorkerRegistry.register(a);

    expect(productWorkerRegistry.get('a.dot')).toBe(a);
  });

  it('register overwrites a previous entry for the same productId', () => {
    const a1 = fakeInstance('a.dot');
    const a2 = fakeInstance('a.dot');
    productWorkerRegistry.register(a1);
    productWorkerRegistry.register(a2);

    expect(productWorkerRegistry.get('a.dot')).toBe(a2);
  });

  it('unregister removes only when identity matches', () => {
    const a1 = fakeInstance('a.dot');
    const a2 = fakeInstance('a.dot');
    productWorkerRegistry.register(a1);
    productWorkerRegistry.register(a2);

    productWorkerRegistry.unregister(a1);
    expect(productWorkerRegistry.get('a.dot')).toBe(a2);

    productWorkerRegistry.unregister(a2);
    expect(productWorkerRegistry.get('a.dot')).toBeNull();
  });

  it('unregister of unknown productId is a no-op (preserves reference)', () => {
    const a = fakeInstance('a.dot');
    productWorkerRegistry.register(a);
    const before = productWorkerRegistry.instances$.get();

    productWorkerRegistry.unregister(fakeInstance('b.dot'));
    const after = productWorkerRegistry.instances$.get();

    expect(after).toBe(before);
  });

  it('instance$(productId) emits null then the instance then null on unregister', async () => {
    const a = fakeInstance('a.dot');
    const collected = firstValueFrom(productWorkerRegistry.instance$('a.dot').pipe(take(3), toArray()));

    productWorkerRegistry.register(a);
    productWorkerRegistry.unregister(a);

    expect(await collected).toEqual([null, a, null]);
  });
});
