// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import type * as productDomain from '@/domains/product';
import { type PersistedProduct, permissionsUseCase, productsResource } from '@/domains/product';

import { PermissionDetailPage } from './PermissionDetailPage';

function seedTicketsProduct() {
  const row = {
    baseName: 'tickets.dot',
    displayName: 'Ticket App',
    description: '',
    icon: { cid: '', format: 'png' },
    executables: {},
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
  } as unknown as PersistedProduct;

  productsResource.instead(() => of([row]));
}

const mocks = { aggregated: [] as productDomain.AggregatedPermission[] };

// The aggregated-permission read is core-backed, not resource-backed, so the use-case
// method behind the hook is spied in place; the hook itself stays real.
vi.spyOn(permissionsUseCase, 'watchAggregatedPermissions').mockImplementation(() => of(mocks.aggregated));

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

describe('PermissionDetailPage', () => {
  it('lists each product holding the permission, without inline pattern dropdowns', async () => {
    seedTicketsProduct();
    mocks.aggregated = [
      {
        id: 'ExternalRequest',
        grantedCount: 1,
        apps: [{ productId: 'tickets.dot', status: 'granted' }],
      },
    ];

    render(
      <Providers>
        <PermissionDetailPage permissionId="ExternalRequest" onBack={() => {}} />
      </Providers>,
    );

    expect(await screen.findByText('tickets.dot')).toBeTruthy();
    expect(screen.queryByText('https://a.com')).toBeNull();
  });

  // A stored decision no longer carries a surface, so there is no per-surface suffix
  // left to render.
  it('shows the base name alone as the product subtitle', async () => {
    seedTicketsProduct();
    mocks.aggregated = [
      {
        id: 'Microphone',
        grantedCount: 0,
        apps: [{ productId: 'tickets.dot', status: 'denied' }],
      },
    ];

    render(
      <Providers>
        <PermissionDetailPage permissionId="Microphone" onBack={() => {}} />
      </Providers>,
    );

    expect(await screen.findByText('tickets.dot')).toBeTruthy();
    expect(screen.queryByText(/Allowed for/)).toBeNull();
  });
});
