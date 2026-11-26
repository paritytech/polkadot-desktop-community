// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch';

describe('Switch', () => {
  it('is a named switch that shows its state', () => {
    const { rerender } = render(<Switch checked label="Hide" onCheckedChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Hide' })).toBeChecked();

    rerender(<Switch checked={false} label="Hide" onCheckedChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Hide' })).not.toBeChecked();
  });

  it('asks the owner and does not flip by itself', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} label="Hide" onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole('switch', { name: 'Hide' }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Hide' })).not.toBeChecked();
  });

  it('moves a checked knob towards the start in a right-to-left layout', () => {
    render(
      <div dir="rtl">
        <Switch checked label="Hide" onCheckedChange={vi.fn()} />
      </div>,
    );

    expect(screen.getByRole('switch', { name: 'Hide' })).toHaveClass('after:translate-x-4', 'rtl:after:-translate-x-4');
  });

  // `transition-colors` animates outline-color too, so the ring would fade in from the text colour.
  it('draws its focus ring in the focus colour without fading it in', () => {
    render(<Switch checked={false} label="Hide" onCheckedChange={vi.fn()} />);

    const control = screen.getByRole('switch', { name: 'Hide' });
    expect(control).toHaveClass('focus-visible:outline-chrome-focus');
    expect(control).not.toHaveClass('transition-colors');
  });
});
