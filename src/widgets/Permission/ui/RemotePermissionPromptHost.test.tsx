// @vitest-environment happy-dom

import type * as trUi from '@novasamatech/tr-ui';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationProvider } from '@/shared/components';
import { TranslationProvider } from '@/shared/translation';
import type * as productDomain from '@/domains/product';
import { _resetRemotePermissionBroker, requestExternalUrlAccess } from '@/domains/product';

import { RemotePermissionPromptHost } from './RemotePermissionPromptHost';

const mockRemoteRun = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/domains/product', async () => {
  const actual = await vi.importActual<typeof productDomain>('@/domains/product');
  return {
    ...actual,
    useSetRemotePermission: () => ({ run: mockRemoteRun, status: undefined, pending: false }),
  };
});

vi.mock('@novasamatech/tr-ui', async () => {
  const actual = await vi.importActual<typeof trUi>('@novasamatech/tr-ui');
  return {
    ...actual,
    toastError: (...args: unknown[]) => mockToastError(...args),
  };
});

const Providers = ({ children }: PropsWithChildren) => (
  <TranslationProvider>
    <ConfirmationProvider>{children}</ConfirmationProvider>
  </TranslationProvider>
);

describe('RemotePermissionPromptHost', () => {
  beforeEach(() => {
    _resetRemotePermissionBroker();
    mockRemoteRun.mockClear();
    mockToastError.mockClear();
  });

  it('renders nothing when there are no pending permission requests', () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a dialog when the broker emits a pending external-url request', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    await act(async () => {
      void requestExternalUrlAccess({
        productId: 'pr239.parity.dot',
        url: 'https://storage.googleapis.com/a/b.png',
        modality: 'app',
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    expect(screen.getByText('https://storage.googleapis.com')).toBeTruthy();
  });

  it('persists an ExternalRequest grant and resolves granted on Allow always', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let decision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      decision = requestExternalUrlAccess({
        productId: 'pr239.parity.dot',
        url: 'https://storage.googleapis.com/a/b.png',
        modality: 'app',
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /always allow/i }));

    await act(async () => {
      await expect(decision).resolves.toBe('granted');
    });
    expect(mockRemoteRun).toHaveBeenCalledWith({
      productId: 'pr239.parity.dot',
      permission: {
        payload: { type: 'Remote', pattern: 'https://storage.googleapis.com' },
        modality: 'app',
        status: 'granted',
      },
    });
  });

  it('resolves granted without persisting on Allow once', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let decision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      decision = requestExternalUrlAccess({
        productId: 'pr239.parity.dot',
        url: 'https://storage.googleapis.com/a/b.png',
        modality: 'app',
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /allow once/i }));

    await act(async () => {
      await expect(decision).resolves.toBe('granted');
    });
    expect(mockRemoteRun).not.toHaveBeenCalled();
  });

  it('persists a denied ExternalRequest, resolves denied, and shows a toast on Deny', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let decision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      decision = requestExternalUrlAccess({
        productId: 'pr239.parity.dot',
        url: 'https://storage.googleapis.com/a/b.png',
        modality: 'app',
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /don't allow/i }));

    await act(async () => {
      await expect(decision).resolves.toBe('denied');
    });
    expect(mockRemoteRun).toHaveBeenCalledWith({
      productId: 'pr239.parity.dot',
      permission: {
        payload: { type: 'Remote', pattern: 'https://storage.googleapis.com' },
        modality: 'app',
        status: 'denied',
      },
    });
    expect(mockToastError).toHaveBeenCalled();
  });

  it('shows a dialog for the next pending request after the first is resolved', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let firstDecision: Promise<string> = Promise.resolve('pending');
    let secondDecision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      firstDecision = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn-a.example.com/a.png', modality: 'app' });
      secondDecision = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn-b.example.com/b.png', modality: 'app' });
    });

    await waitFor(() => expect(screen.getByText('https://cdn-a.example.com')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: /allow once/i }));
    await act(async () => {
      await expect(firstDecision).resolves.toBe('granted');
    });

    await waitFor(() => expect(screen.getByText('https://cdn-b.example.com')).toBeTruthy());
    await userEvent.click(screen.getByRole('button', { name: /allow once/i }));
    await act(async () => {
      await expect(secondDecision).resolves.toBe('granted');
    });
  });

  it('waits for the exit transition before resolving the broker (chained modal transition)', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let decision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      decision = requestExternalUrlAccess({ productId: 'p.dot', url: 'https://cdn.example.com/x.png', modality: 'app' });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: /allow once/i }));

    // The broker must NOT resolve on the same tick as the click — the host
    // waits for the dialog's exit transition before advancing the queue.
    const pendingSentinel = Symbol('pending');
    const sentinelPromise = new Promise(r => window.setTimeout(() => r(pendingSentinel), 0));
    const winner = await Promise.race([decision, sentinelPromise]);
    expect(winner).toBe(pendingSentinel);

    await act(async () => {
      await expect(decision).resolves.toBe('granted');
    });
  });

  it('is idempotent against rapid double-clicks (does not persist twice)', async () => {
    render(
      <Providers>
        <RemotePermissionPromptHost />
      </Providers>,
    );

    let decision: Promise<string> = Promise.resolve('pending');
    await act(async () => {
      decision = requestExternalUrlAccess({
        productId: 'pr239.parity.dot',
        url: 'https://storage.googleapis.com/a/b.png',
        modality: 'app',
      });
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
    const allowButton = screen.getByRole('button', { name: /always allow/i });
    await userEvent.click(allowButton);
    await userEvent.click(allowButton);

    await act(async () => {
      await expect(decision).resolves.toBe('granted');
    });
    expect(mockRemoteRun).toHaveBeenCalledTimes(1);
  });
});
