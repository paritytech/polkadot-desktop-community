import { asProductId } from '@parity/truapi';
import { type ProductContext, type UserConfirmationReview } from '@parity/truapi-host';
import { describe, expect, it, vi } from 'vitest';

import { type HostPrompts } from '../createHostCallbacks';

import { deferredHostPrompts, registerHostPrompts } from './prompts';

const DEMO = asProductId('demo.dot');

const product: ProductContext = { productId: DEMO, executionKind: 'App' };
const review: UserConfirmationReview = { tag: 'ResourceAllocation', value: { callingProductId: DEMO, resources: [] } };

function createPrompts(): HostPrompts {
  return {
    permissions: {
      devicePermission: vi.fn(async () => 'AllowOnce' as const),
      remotePermission: vi.fn(async () => 'AllowAlways' as const),
    },
    userConfirmation: {
      confirmUserAction: vi.fn(async () => true),
      confirmPermission: vi.fn(async () => 'AllowOnce' as const),
    },
  };
}

// Settles every pending microtask a deferred call could have queued, so a call that
// is still waiting is observably still waiting.
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('deferredHostPrompts', () => {
  it('holds a prompt raised before the UI registers, then asks through it', async () => {
    const answer = vi.fn();
    void deferredHostPrompts.permissions.devicePermission(product, 'Camera').then(answer);
    await flush();
    expect(answer).not.toHaveBeenCalled();

    const prompts = createPrompts();
    const unregister = registerHostPrompts(prompts);

    await vi.waitFor(() => expect(answer).toHaveBeenCalledWith('AllowOnce'));
    expect(prompts.permissions.devicePermission).toHaveBeenCalledWith(product, 'Camera');
    unregister();
  });

  it('forwards every prompt to the registered surface', async () => {
    const prompts = createPrompts();
    const unregister = registerHostPrompts(prompts);

    await expect(deferredHostPrompts.permissions.remotePermission(product, { permission: { tag: 'ChainSubmit' } })).resolves.toBe(
      'AllowAlways',
    );
    await expect(deferredHostPrompts.userConfirmation.confirmUserAction(review)).resolves.toBe(true);
    await expect(deferredHostPrompts.userConfirmation.confirmPermission(review)).resolves.toBe('AllowOnce');
    unregister();
  });

  it('holds prompts again once the UI unregisters', async () => {
    registerHostPrompts(createPrompts())();

    const answer = vi.fn();
    void deferredHostPrompts.userConfirmation.confirmUserAction(review).then(answer);
    await flush();

    expect(answer).not.toHaveBeenCalled();
  });

  // A remount registers its prompts before the previous mounting's cleanup runs.
  it('keeps a newer registration when an older one unregisters', async () => {
    const unregisterOld = registerHostPrompts(createPrompts());
    const newer = createPrompts();
    const unregisterNewer = registerHostPrompts(newer);

    unregisterOld();
    await deferredHostPrompts.userConfirmation.confirmUserAction(review);

    expect(newer.userConfirmation.confirmUserAction).toHaveBeenCalledWith(review);
    unregisterNewer();
  });
});
