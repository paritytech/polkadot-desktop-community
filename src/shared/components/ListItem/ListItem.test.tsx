// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListItem } from './ListItem';

describe('ListItem', () => {
  it('is a button named by its label', () => {
    render(<ListItem icon={<svg />} label="Wallet" onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Wallet' })).toHaveAttribute('type', 'button');
  });

  it.each(['{Enter}', ' '])('calls onClick on the %j key', async key => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListItem icon={<svg />} label="Wallet" onClick={onClick} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Wallet' })).toHaveFocus();
    await user.keyboard(key);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
