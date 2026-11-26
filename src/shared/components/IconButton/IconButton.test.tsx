// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '../DropdownMenu/DropdownMenu';

import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('is named by its label', () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('type', 'button');
  });

  it('opts out of the app focus ring and merges a caller style with no-drag', () => {
    render(
      <IconButton label="Close" style={{ color: 'red' }}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveAttribute('data-no-app-focus');
    expect(button.style.color).toBe('red');
    expect(button.style.getPropertyValue('app-region')).toBe('no-drag');
  });

  // `transition-colors` animates outline-color too, so the ring would fade in from the text colour.
  it('draws its focus ring in the focus colour without fading it in', () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveClass('focus-visible:outline-chrome-focus');
    expect(button).not.toHaveClass('transition-colors');
  });

  it('takes the open state a trigger passes', () => {
    const ref = createRef<HTMLButtonElement>();
    const onMouseDown = vi.fn();
    render(
      <IconButton ref={ref} label="Menu" aria-expanded onMouseDown={onMouseDown}>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(ref.current).toBe(button);

    fireEvent.mouseDown(button);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  it('is transparent by default', () => {
    render(
      <IconButton label="Close">
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('bg-transparent');
  });

  it('fills a pressed ghost button without a shadow', () => {
    render(
      <IconButton label="Smileys" aria-pressed>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Smileys' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('aria-pressed:bg-chrome-fill-strong');
    expect(button).not.toHaveClass('aria-pressed:shadow-chrome-raised');
  });

  it('draws a raised disc', () => {
    render(
      <IconButton label="Remove" variant="raised">
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass('bg-chrome-surface', 'shadow-chrome-raised');
  });

  it('draws the primary look', () => {
    render(
      <IconButton label="Send" variant="primary">
        <svg />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass('text-chrome-on-primary');
  });

  it('draws the disabled look instead of the primary one when disabled', () => {
    render(
      <IconButton label="Send" variant="primary" disabled>
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveClass('text-chrome-faint');
    expect(button).not.toHaveClass('text-chrome-on-primary');
  });

  it('keeps its own classes under a menu trigger', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton size="sm" label="Menu" onClick={onClick}>
            <svg />
          </IconButton>
        </DropdownMenu.Trigger>
      </DropdownMenu.Root>,
    );

    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveClass('size-control-sm', 'rounded-full');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-state', 'closed');

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('data-state', 'open');
  });
});
