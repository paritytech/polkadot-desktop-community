// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  it('opens on a context menu event and selects an item', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          <div>Area</div>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
          <ContextMenu.Item onSelect={onAdd}>Add</ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>,
    );

    fireEvent.contextMenu(screen.getByText('Area'));
    await user.click(await screen.findByRole('menuitem', { name: 'Add' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
