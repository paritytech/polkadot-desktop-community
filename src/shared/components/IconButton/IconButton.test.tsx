// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
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
});
