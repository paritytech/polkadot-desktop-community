// @vitest-environment happy-dom

import { DropdownMenu } from '@novasamatech/tr-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

  it('keeps its own classes under a tr-ui menu trigger', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton size="xs" label="Menu" onClick={onClick}>
            <svg />
          </IconButton>
        </DropdownMenu.Trigger>
      </DropdownMenu>,
    );

    const button = screen.getByRole('button', { name: 'Menu' });
    expect(button).toHaveClass('size-6', 'rounded-full');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-state', 'closed');

    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('data-state', 'open');
  });
});
