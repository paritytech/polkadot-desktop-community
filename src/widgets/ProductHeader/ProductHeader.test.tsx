// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductHeader } from './ProductHeader';

describe('ProductHeader', () => {
  it('renders the description when it differs from the name', () => {
    render(<ProductHeader name="Wallet" description="wallet.dot" />);

    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('wallet.dot')).toBeInTheDocument();
  });

  it('omits the description when it equals the name', () => {
    render(<ProductHeader name="Wallet" description="Wallet" />);

    expect(screen.getAllByText('Wallet')).toHaveLength(1);
  });

  it('omits the description when it is empty', () => {
    const { container } = render(<ProductHeader name="Wallet" description="" />);

    expect(container.querySelector('[data-slot=product-header]')).toHaveTextContent(/^Wallet$/);
  });

  it('shows the icon when the icon image fails to load', () => {
    render(<ProductHeader name="Wallet" iconSrc="x.png" icon={<span data-testid="fallback-icon" />} />);

    fireEvent.error(screen.getByRole('img', { name: 'Wallet' }));

    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument();
  });

  it('renders the icon when there is no icon image', () => {
    render(<ProductHeader name="Wallet" icon={<span data-testid="fallback-icon" />} />);

    expect(screen.getByTestId('fallback-icon')).toBeInTheDocument();
  });
});
