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
});
