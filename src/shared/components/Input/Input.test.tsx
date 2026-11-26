// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { type ComponentProps, createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('renders the input with the caller attributes inside its wrapper when there is no leading icon', () => {
    const { container } = render(<Input aria-label="Search" data-testid="field" placeholder="Find" type="search" />);

    const input = screen.getByTestId('field');
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild?.children).toHaveLength(1);
    expect(container.firstElementChild?.firstElementChild).toBe(input);
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

  it('renders the trailing content after the input and keeps the caller attributes and ref on the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <Input ref={ref} aria-label="Search" data-testid="field" trailing={<button type="button">Clear</button>} type="search" />,
    );

    const input = screen.getByRole('searchbox', { name: 'Search' });
    const clear = screen.getByRole('button', { name: 'Clear' });
    expect(input).toBe(screen.getByTestId('field'));
    expect(ref.current).toBe(input);
    expect(input.compareDocumentPosition(clear) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.parentElement).toHaveClass('pe-1');
  });

  it('uses the full end inset when there is no trailing content', () => {
    render(<Input aria-label="Search" data-testid="field" />);

    expect(screen.getByTestId('field').parentElement).not.toHaveClass('pe-1');
  });

  it('focuses the input on a press on the leading icon or the padding', () => {
    render(<Input aria-label="Search" data-testid="field" leading={<svg data-testid="icon" />} />);
    const input = screen.getByTestId('field');

    expect(fireEvent.mouseDown(screen.getByTestId('icon'))).toBe(false);
    expect(input).toHaveFocus();

    input.blur();
    expect(fireEvent.mouseDown(input.parentElement!)).toBe(false);
    expect(input).toHaveFocus();
  });

  it('leaves a press on the trailing content to that content', () => {
    render(<Input aria-label="Search" data-testid="field" trailing={<button type="button">Clear</button>} />);

    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear' }))).toBe(true);
    expect(screen.getByTestId('field')).not.toHaveFocus();
  });

  // A Radix `asChild` slot merges its own `className` into the child's props, which the type alone cannot stop.
  it('keeps its own classes, style and focus opt-out when a slot passes them', () => {
    const slotProps = { className: 'slot-class', style: { color: 'red' } } as ComponentProps<typeof Input>;
    render(<Input aria-label="Search" data-testid="field" id="search" {...slotProps} />);

    const input = screen.getByTestId('field');
    expect(input.parentElement).toHaveClass('rounded-full', 'bg-chrome-well');
    expect(input).not.toHaveClass('slot-class');
    expect(input).toHaveAttribute('id', 'search');
    expect(input).toHaveAttribute('data-no-app-focus');
    expect(input.style.color).toBe('red');
    expect(input.style.getPropertyValue('app-region')).toBe('no-drag');
  });
});
