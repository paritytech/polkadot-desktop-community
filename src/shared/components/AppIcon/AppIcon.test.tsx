// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppIcon } from './AppIcon';

describe('AppIcon', () => {
  it('renders the image with its src and alt', () => {
    render(<AppIcon size="44" src="https://example.com/a.png" alt="Alpha" />);

    const img = screen.getByRole('img', { name: 'Alpha' });
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('shows the children when the image fails to load', () => {
    render(
      <AppIcon size="44" src="https://example.com/a.png" alt="Alpha">
        <span>fallback</span>
      </AppIcon>,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Alpha' }));

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });

  it('draws the placeholder after the image fails with no children', () => {
    const { container } = render(<AppIcon size="44" src="https://example.com/a.png" alt="Alpha" />);

    fireEvent.error(screen.getByRole('img', { name: 'Alpha' }));

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('[data-slot=app-icon] svg')).not.toBeNull();
  });

  it('retries the image when the src changes after a failure', () => {
    const { rerender } = render(<AppIcon size="44" src="https://example.com/a.png" alt="Alpha" />);

    fireEvent.error(screen.getByRole('img', { name: 'Alpha' }));
    rerender(<AppIcon size="44" src="https://example.com/b.png" alt="Alpha" />);

    expect(screen.getByRole('img', { name: 'Alpha' })).toHaveAttribute('src', 'https://example.com/b.png');
  });

  it('renders the placeholder glyph with no src and no children', () => {
    const { container } = render(<AppIcon size="24" />);

    expect(container.querySelector('[data-slot=app-icon] svg')).not.toBeNull();
  });

  it('sizes the tile by the size prop', () => {
    const { container } = render(<AppIcon size="44" />);

    expect(container.querySelector('[data-slot=app-icon]')).toHaveClass('size-11');
  });
});
