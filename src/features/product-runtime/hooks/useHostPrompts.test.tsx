// @vitest-environment happy-dom

import { asProductId } from '@parity/truapi';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ConfirmationProvider } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type DevicePermissionType } from '@/domains/product';
/* eslint-disable boundaries/dependencies -- the test observes the write where it lands; the barrel exposes no read for it */
import {
  _resetTransientDevicePermissionGrants,
  getTransientDevicePermissionGranted,
} from '@/domains/product/permissions/resource';
/* eslint-enable boundaries/dependencies */

import { useHostPrompts } from './useHostPrompts';

const wrapper = ({ children }: PropsWithChildren) => (
  <TranslationProvider locale="en">
    <ConfirmationProvider>{children}</ConfirmationProvider>
  </TranslationProvider>
);

const DEMO = asProductId('demo.dot');

const signRawReview = {
  tag: 'SignRaw',
  value: {
    tag: 'Product',
    value: {
      request: {
        account: { dotNsIdentifier: DEMO, derivationIndex: { tag: 'Index', value: 0 } },
        payload: { tag: 'Bytes', value: { bytes: '0x01' } },
      },
      watermarked: true,
    },
  },
} as const;

const unwatermarkedSignRawReview = {
  tag: 'SignRaw',
  value: {
    tag: 'Product',
    value: {
      request: {
        account: { dotNsIdentifier: DEMO, derivationIndex: { tag: 'Index', value: 0 } },
        payload: { tag: 'Bytes', value: { bytes: '0x01' } },
      },
      watermarked: false,
    },
  },
} as const;

const identityReview = { tag: 'IdentityDisclosure', value: { productId: DEMO } } as const;

const appProduct = { productId: DEMO, executionKind: 'App' } as const;
const widgetProduct = { productId: DEMO, executionKind: 'Widget' } as const;

afterEach(() => {
  _resetTransientDevicePermissionGrants();
});

// Asking for a prompt mounts a dialog into ConfirmationProvider synchronously, so
// the render it schedules must be driven inside act. The returned decision stays
// pending until the user answers it below.
const openPrompt = <T,>(request: () => Promise<T>): Promise<T> => {
  let decision!: Promise<T>;
  act(() => {
    decision = request();
  });

  return decision;
};

describe('sign-raw watermarking', () => {
  // The core stamps a watermark so a signature cannot be replayed as a transaction.
  // Without one the bytes may BE a transaction, and the upstream contract requires the
  // host to say so — a silent drop of this warning is the failure worth a test.
  it('warns when the payload is not watermarked', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    openPrompt(() => result.current.userConfirmation.confirmUserAction(unwatermarkedSignRawReview));

    expect(await screen.findByText(/isn't watermarked/i)).toBeInTheDocument();
  });

  it('shows no such warning for a watermarked payload', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    openPrompt(() => result.current.userConfirmation.confirmUserAction(signRawReview));

    await screen.findByTestId(TEST_IDS.signReviewContinueButton);

    expect(screen.queryByText(/isn't watermarked/i)).not.toBeInTheDocument();
  });
});

describe('confirmUserAction', () => {
  it('resolves true when the user approves', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.userConfirmation.confirmUserAction(signRawReview));

    await userEvent.click(await screen.findByTestId(TEST_IDS.signReviewContinueButton));

    await expect(decision).resolves.toBe(true);
  });

  it('resolves false when the user rejects', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.userConfirmation.confirmUserAction(signRawReview));

    await userEvent.click(await screen.findByTestId(TEST_IDS.productRequestDeny));

    await expect(decision).resolves.toBe(false);
  });

  it('rejects a review it has no surface for, without opening a dialog', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = result.current.userConfirmation.confirmUserAction({
      tag: 'NftPurseDrain',
      value: {
        callingProductId: DEMO,
        fromPurse: 0,
        owner: { tag: 'Root' },
        itemCount: 1,
        destination: { tag: 'Cheque' },
      },
    });

    await expect(decision).resolves.toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Fail closed: anything that tears the prompt down without an answer is a denial,
  // never a silent approval.
  it('resolves false when the prompt is disposed without an answer', async () => {
    const { result, unmount } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.userConfirmation.confirmUserAction(signRawReview));
    await screen.findByTestId(TEST_IDS.signReviewContinueButton);
    unmount();

    await expect(decision).resolves.toBe(false);
  });

  // Two products can be waiting at once. The dialogs stack, so only the topmost is
  // clickable — but the one underneath must stay *pending*, not be silently resolved
  // as denied. That is the failure mode of reusing one confirmation id.
  it('does not resolve an earlier review when a second one opens', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });
    const settled: string[] = [];

    const first = openPrompt(() => result.current.userConfirmation.confirmUserAction(signRawReview));
    void first.then(() => settled.push('first'));

    const second = openPrompt(() => result.current.userConfirmation.confirmUserAction(identityReview));
    void second.then(() => settled.push('second'));

    // Two different requests, so two different surfaces: the raw-signing review and the
    // key-listing prompt. Both being up is what the stacking test is about.
    await waitFor(async () => {
      expect(await screen.findAllByTestId(TEST_IDS.productRequestDeny)).toHaveLength(2);
    });

    await userEvent.click(await screen.findByTestId(TEST_IDS.keyListingPermissionAllow));

    await expect(second).resolves.toBe(true);
    expect(settled).toEqual(['second']);
  });
});

describe('permission prompts', () => {
  it('returns a lasting grant when the user allows always', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.permissions.devicePermission(appProduct, 'Camera'));
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogAllowAlways));

    await expect(decision).resolves.toBe('AllowAlways');
  });

  it('returns a one-shot grant when the user allows once', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.permissions.devicePermission(appProduct, 'Notifications'));
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogAllowOnce));

    await expect(decision).resolves.toBe('AllowOnce');
  });

  it('names the requesting product', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    openPrompt(() => result.current.permissions.devicePermission(appProduct, 'Camera'));

    expect(await screen.findByText(/demo\.dot/)).toBeInTheDocument();
  });

  // Electron's native gate is a second gate the core's answer does not reach; without
  // a transient grant the product is told `granted` and its request is refused.
  it.each(['Camera', 'Microphone', 'Location'] as const)('opens the native gate for a one-shot %s grant', async capability => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.permissions.devicePermission(appProduct, capability));
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogAllowOnce));

    await expect(decision).resolves.toBe('AllowOnce');
    expect(getTransientDevicePermissionGranted({ productId: 'demo.dot', permission: capability, executionKind: 'App' })).toBe(
      true,
    );
  });

  it('records a widget one-shot grant under the widget execution kind', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.permissions.devicePermission(widgetProduct, 'Camera'));
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogAllowOnce));

    await decision;
    expect(getTransientDevicePermissionGranted({ productId: 'demo.dot', permission: 'Camera', executionKind: 'Widget' })).toBe(
      true,
    );
    expect(getTransientDevicePermissionGranted({ productId: 'demo.dot', permission: 'Camera', executionKind: 'App' })).toBe(
      false,
    );
  });

  it.each([TEST_IDS.permissionDialogAllowAlways, TEST_IDS.permissionDialogDeny])(
    'records no transient grant when the user answers with %s',
    async testId => {
      const { result } = renderHook(() => useHostPrompts(), { wrapper });

      const decision = openPrompt(() => result.current.permissions.devicePermission(appProduct, 'Camera'));
      await userEvent.click(await screen.findByTestId(testId));

      await decision;
      expect(getTransientDevicePermissionGranted({ productId: 'demo.dot', permission: 'Camera', executionKind: 'App' })).toBe(
        false,
      );
    },
  );

  it('records no device grant for a one-shot remote permission', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() =>
      result.current.permissions.remotePermission(appProduct, { permission: { tag: 'ChainSubmit' } }),
    );
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogAllowOnce));

    await expect(decision).resolves.toBe('AllowOnce');
    expect(
      getTransientDevicePermissionGranted({
        productId: 'demo.dot',
        permission: 'ChainSubmit' as DevicePermissionType,
        executionKind: 'App',
      }),
    ).toBe(false);
  });

  it('denies a remote permission the user rejects, naming the capability', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() =>
      result.current.permissions.remotePermission(appProduct, { permission: { tag: 'ChainSubmit' } }),
    );

    // The shared dialog resolves the wire tag to real copy, not "[object Object]"
    // and not the bare tag.
    expect(await screen.findByText('Allow Access to Chain Submit?')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId(TEST_IDS.permissionDialogDeny));

    await expect(decision).resolves.toBe('Deny');
  });

  // A `Remote` request names domains; the dialog promises to list them.
  it('lists the domains a remote request names', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    openPrompt(() =>
      result.current.permissions.remotePermission(appProduct, {
        permission: { tag: 'Remote', value: { domains: ['example.com'] } },
      }),
    );

    expect(await screen.findByText('example.com')).toBeInTheDocument();
  });

  // Fail closed, same rule as `confirmUserAction`.
  it('denies when the prompt is torn down unanswered', async () => {
    const { result, unmount } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.permissions.devicePermission(appProduct, 'Camera'));
    await screen.findByTestId(TEST_IDS.permissionDialogDeny);
    unmount();

    await expect(decision).resolves.toBe('Deny');
    expect(getTransientDevicePermissionGranted({ productId: 'demo.dot', permission: 'Camera', executionKind: 'App' })).toBe(
      false,
    );
  });

  // `confirmPermission` shares the review surface with `confirmUserAction` and never
  // offers a lifetime, so an approval is one-shot.
  it('maps an approved confirmPermission review to a one-shot grant', async () => {
    const { result } = renderHook(() => useHostPrompts(), { wrapper });

    const decision = openPrompt(() => result.current.userConfirmation.confirmPermission(identityReview));
    await userEvent.click(await screen.findByTestId(TEST_IDS.keyListingPermissionAllow));

    await expect(decision).resolves.toBe('AllowOnce');
  });
});
