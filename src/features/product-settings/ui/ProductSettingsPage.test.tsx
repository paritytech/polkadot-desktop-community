// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { type PersistedProduct, permissionsUseCase, productsResource } from '@/domains/product';
import { productManagementUseCase } from '@/aggregates/product-management';

import { ProductSettingsPage } from './ProductSettingsPage';

// The permission reads are core-backed (an injected adapter, not a resource), so the
// use-case methods behind the hooks are spied in place. `permissionsService` and
// `productService` stay real: the grant-wins roll-up is a business rule, and a copy
// of it here would pass after the real one changed.
vi.spyOn(permissionsUseCase, 'watchProductPermissions').mockReturnValue(of([]));
const watchGrantedAccountAccess = vi.spyOn(permissionsUseCase, 'watchGrantedAccountAccess').mockReturnValue(of([]));
vi.spyOn(productManagementUseCase, 'clearProductData').mockResolvedValue();
const forgetProductMock = vi.spyOn(productManagementUseCase, 'forgetProduct').mockResolvedValue(true);

function seedProducts(records: Partial<PersistedProduct>[]) {
  productsResource.instead(() => of(records as PersistedProduct[]));
}

const renderPage = (productId: string) =>
  render(
    <TranslationProvider>
      <ProductSettingsPage productId={productId} backLabel="Back" onBack={vi.fn()} />
    </TranslationProvider>,
  );

describe('ProductSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    watchGrantedAccountAccess.mockReturnValue(of([]));
  });

  it('forgets a permission-only product even when it cannot be resolved', async () => {
    const user = userEvent.setup();
    renderPage('localhost:5173');

    // Page-level button opens the dialog; the second 'Forget App' is the confirm.
    await user.click(await screen.findByText('Forget App'));
    const confirm = screen.getAllByText('Forget App')[1]!;
    await user.click(confirm);

    expect(forgetProductMock).toHaveBeenCalledWith('localhost:5173');
  });

  it('renders the product description', async () => {
    seedProducts([{ baseName: 'editor.dot', displayName: 'Editor', description: 'Lightweight editor' }]);
    renderPage('editor.dot');

    expect(await screen.findByText('Lightweight editor')).toBeInTheDocument();
  });

  it('lists account access held at "ask" with the "Ask (Default)" status', async () => {
    watchGrantedAccountAccess.mockReturnValue(of([{ targetProductId: 'dot', status: 'ask' }]));

    renderPage('localhost:5173');

    expect(await screen.findByText('Alias')).toBeInTheDocument();
    expect(screen.getByText('Ask (Default)')).toBeInTheDocument();
    expect(screen.queryByText('Denied')).not.toBeInTheDocument();
  });
});
