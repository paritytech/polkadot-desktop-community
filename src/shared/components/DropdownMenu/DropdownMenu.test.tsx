// @vitest-environment happy-dom

import { DirectionProvider } from '@radix-ui/react-direction';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from './DropdownMenu';

const renderMenu = (wrap: (menu: ReactNode) => ReactNode = menu => menu) => {
  const onRename = vi.fn();
  const onLocked = vi.fn();

  render(
    wrap(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button>Menu</button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item data-testid="rename" onSelect={onRename}>
            Rename
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="danger">Delete</DropdownMenu.Item>
          <DropdownMenu.Item disabled onSelect={onLocked}>
            Locked
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    ),
  );

  return { onRename, onLocked };
};

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await screen.findByRole('menu');
};

// Radix sets the width left for the menu, the window minus the collision padding on both sides, on the popper wrapper.
const availableWidth = async (contentProps: Pick<ComponentProps<typeof DropdownMenu.Content>, 'collisionPadding'>) => {
  const user = userEvent.setup();
  const { unmount } = render(
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button>Menu</button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content {...contentProps}>
        <DropdownMenu.Item>Rename</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>,
  );
  await open(user);
  const width = parseFloat(
    screen.getByRole('menu').parentElement?.style.getPropertyValue('--radix-popper-available-width') ?? '',
  );
  unmount();

  return width;
};

describe('DropdownMenu', () => {
  it('shows its items as menu items', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: 'Menu' }));

    expect(await screen.findAllByRole('menuitem')).toHaveLength(3);
  });

  it('selects an item', async () => {
    const user = userEvent.setup();
    const { onRename } = renderMenu();
    await open(user);

    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(onRename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  });

  it('passes a test id to the item', async () => {
    const user = userEvent.setup();
    renderMenu();

    await open(user);

    expect(screen.getByTestId('rename')).toHaveAttribute('role', 'menuitem');
  });

  it('does not select a disabled item', async () => {
    const user = userEvent.setup();
    const { onLocked } = renderMenu();
    await open(user);

    await user.click(screen.getByRole('menuitem', { name: 'Locked' }));

    expect(onLocked).not.toHaveBeenCalled();
  });

  it('marks the danger item', async () => {
    const user = userEvent.setup();
    renderMenu();

    await open(user);

    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveClass('text-chrome-danger-ink');
  });

  it('keeps 8 px from the window edge by default', async () => {
    const withoutPadding = await availableWidth({ collisionPadding: 0 });
    const withDefault = await availableWidth({});

    expect(withoutPadding - withDefault).toBe(16);
  });

  it('mirrors under a right-to-left provider', async () => {
    const user = userEvent.setup();
    renderMenu(menu => <DirectionProvider dir="rtl">{menu}</DirectionProvider>);

    await open(user);

    expect(screen.getByRole('menu')).toHaveAttribute('dir', 'rtl');
  });
});
