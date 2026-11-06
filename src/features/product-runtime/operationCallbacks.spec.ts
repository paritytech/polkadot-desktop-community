import { asProductId } from '@parity/truapi';
import { describe, expect, it } from 'vitest';

import { createProductOperationsCallbacks } from './operationCallbacks';

const product = (productId: string) => ({ productId: asProductId(productId), executionKind: 'Worker' }) as const;

describe('createProductOperationsCallbacks', () => {
  it('gives every open operation of one product a distinct id', async () => {
    const { productOperations } = createProductOperationsCallbacks();

    const first = await productOperations.beginOperation(product('a.dot'), 'sync');
    const second = await productOperations.beginOperation(product('a.dot'), 'sync');

    expect(first.id).not.toBe(second.id);
  });

  it('reuses an id once its operation has ended', async () => {
    const { productOperations } = createProductOperationsCallbacks();

    const first = await productOperations.beginOperation(product('a.dot'), '');
    await productOperations.endOperation(product('a.dot'), first.id);
    const reopened = await productOperations.beginOperation(product('a.dot'), '');

    expect(reopened.id).toBe(first.id);
  });

  // Ids are per product, so two products may hold the same id at once.
  it('keys open operations per product', async () => {
    const { productOperations } = createProductOperationsCallbacks();

    const a = await productOperations.beginOperation(product('a.dot'), '');
    const b = await productOperations.beginOperation(product('b.dot'), '');

    expect(b.id).toBe(a.id);
  });

  // Upstream: "an unknown or already-ended id returns Ok, so a retry after an
  // ambiguous failure is safe."
  it('ends idempotently, including an id it never issued', async () => {
    const { productOperations } = createProductOperationsCallbacks();

    const open = await productOperations.beginOperation(product('a.dot'), '');

    await expect(productOperations.endOperation(product('a.dot'), open.id)).resolves.toBeUndefined();
    await expect(productOperations.endOperation(product('a.dot'), open.id)).resolves.toBeUndefined();
    await expect(productOperations.endOperation(product('a.dot'), 999)).resolves.toBeUndefined();
    await expect(productOperations.endOperation(product('never.dot'), 0)).resolves.toBeUndefined();
  });

  // Ending one product's operation must not free another product's id.
  it("does not let one product end another product's operation", async () => {
    const { productOperations } = createProductOperationsCallbacks();

    const a = await productOperations.beginOperation(product('a.dot'), '');
    await productOperations.endOperation(product('b.dot'), a.id);
    const next = await productOperations.beginOperation(product('a.dot'), '');

    expect(next.id).not.toBe(a.id);
  });
});
