// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import type * as productDomain from '@/domains/product';

import { PermissionDetailPage } from './PermissionDetailPage';

const mocks = vi.hoisted(() => ({
  aggregated: null as productDomain.AggregatedPermission | null,
}));

vi.mock('@/domains/product', async () => {
  const actual = await vi.importActual<typeof productDomain>('@/domains/product');
  return {
    ...actual,
    useAggregatedPermission: () => ({ data: mocks.aggregated, pending: false }),
    useDisplayedProduct: () => ({
      data: { baseName: 'tickets.dot', displayName: 'Ticket App', description: '', icon: null, executables: {} },
      pending: false,
      error: null,
    }),
  };
});

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

describe('PermissionDetailPage', () => {
  it('shows the allowed-modalities subtitle and no inline pattern dropdowns for ExternalRequest', () => {
    mocks.aggregated = {
      id: 'ExternalRequest',
      grantedCount: 1,
      apps: [
        {
          productId: 'tickets.dot',
          status: 'granted',
          allowedModalities: ['app', 'widget'],
          patterns: [{ pattern: 'https://a.com', modality: 'app', status: 'granted' }],
        },
      ],
    };

    render(
      <Providers>
        <PermissionDetailPage permissionId="ExternalRequest" backLabel="Back" onBack={() => {}} />
      </Providers>,
    );

    expect(screen.getByText(/Allowed for App, Widgets/)).toBeTruthy();
    expect(screen.queryByText('https://a.com')).toBeNull();
  });

  it('omits the allowed-for suffix when nothing is granted', () => {
    mocks.aggregated = {
      id: 'Microphone',
      grantedCount: 0,
      apps: [{ productId: 'tickets.dot', status: 'denied', allowedModalities: [] }],
    };

    render(
      <Providers>
        <PermissionDetailPage permissionId="Microphone" backLabel="Back" onBack={() => {}} />
      </Providers>,
    );

    expect(screen.getByText('tickets.dot')).toBeTruthy();
    expect(screen.queryByText(/Allowed for/)).toBeNull();
  });
});
