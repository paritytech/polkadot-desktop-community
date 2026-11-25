// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Popover } from './Popover';

const renderPopover = () => {
  render(
    <Popover.Root>
      <Popover.Trigger asChild>
        <button>Open</button>
      </Popover.Trigger>
      <Popover.Content>
        <p>Body</p>
      </Popover.Content>
    </Popover.Root>,
  );
};

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Open' }));
  await screen.findByText('Body');
};

describe('Popover', () => {
  it('opens from its trigger and marks it expanded', async () => {
    const user = userEvent.setup();
    renderPopover();

    await open(user);

    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderPopover();
    await open(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByText('Body')).toBeNull());
  });

  it('draws a no-drag surface', async () => {
    const user = userEvent.setup();
    renderPopover();

    await open(user);

    expect(screen.getByRole('dialog').style.getPropertyValue('app-region')).toBe('no-drag');
  });

  it('shortens both the entry and the exit animation under reduced motion', async () => {
    const user = userEvent.setup();
    renderPopover();

    await open(user);

    expect(screen.getByRole('dialog')).toHaveClass(
      'motion-reduce:[animation-duration:0.01ms]',
      'motion-reduce:data-[state=closed]:[animation-duration:0.01ms]',
    );
  });

  it('clears a leftover body lock after the last layer closes', async () => {
    const user = userEvent.setup();
    renderPopover();
    await open(user);

    document.body.style.pointerEvents = 'none';
    document.body.setAttribute('data-scroll-locked', '1');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(document.body.style.pointerEvents).toBe('');
      expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
    });
  });
});
