// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('renders a bare input with the caller attributes when there is no leading icon', () => {
    const { container } = render(<Input aria-label="Search" data-testid="field" placeholder="Find" type="search" />);

    const input = screen.getByTestId('field');
    expect(container.firstElementChild).toBe(input);
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('aria-label', 'Search');
    expect(input).toHaveAttribute('placeholder', 'Find');
    expect(input).toHaveAttribute('data-no-app-focus');
  });

  it('renders the leading icon and keeps the caller attributes on the input', () => {
    render(<Input aria-label="Search" data-testid="field" leading={<svg data-testid="icon" />} type="search" />);

    const input = screen.getByTestId('field');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('aria-label', 'Search');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBe(input);
  });

  // A Radix `asChild` slot merges its own `className` into the child's props, which the type alone cannot stop.
  it('keeps its own classes, style and focus opt-out when a slot passes them', () => {
    const slotProps = { className: 'slot-class', style: { color: 'red' } } as ComponentProps<typeof Input>;
    render(<Input aria-label="Search" data-testid="field" id="search" {...slotProps} />);

    const input = screen.getByTestId('field');
    expect(input).toHaveClass('rounded-full', 'bg-chrome-well');
    expect(input).not.toHaveClass('slot-class');
    expect(input).toHaveAttribute('id', 'search');
    expect(input).toHaveAttribute('data-no-app-focus');
    expect(input.style.color).toBe('red');
    expect(input.style.getPropertyValue('app-region')).toBe('no-drag');
  });
});
