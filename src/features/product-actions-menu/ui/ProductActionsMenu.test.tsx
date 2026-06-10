// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createFeature } from '@/shared/feature';
import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { productActionsMenuItemsSlot } from '../di';

import { MenuItem } from './MenuItem';
import { ProductActionsMenu } from './ProductActionsMenu';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}));

const testFeature = createFeature({ name: 'test/menu-injector' });

testFeature.inject(productActionsMenuItemsSlot, {
  order: 0,
  render: ({ closeMenu }) => (
    <MenuItem
      icon={null}
      label="Test Item"
      onSelect={() => {
        closeMenu();
      }}
    />
  ),
});

describe('ProductActionsMenu', () => {
  it('renders injected items and closes after selecting', async () => {
    const user = userEvent.setup();
    render(
      <TranslationProvider>
        <ProductActionsMenu productId="a.dot" isFocused={false} />
      </TranslationProvider>,
    );

    await user.click(screen.getByTestId(TEST_IDS.productActionsMenuTrigger));
    expect(screen.getByText('Test Item')).toBeInTheDocument();

    await user.click(screen.getByText('Test Item'));
    expect(screen.queryByText('Test Item')).not.toBeInTheDocument();
  });
});
