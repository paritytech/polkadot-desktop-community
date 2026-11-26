// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '@/shared/components';

import { WidgetTopbarAction } from './WidgetTopbarAction';

describe('WidgetTopbarAction', () => {
  it('renders a labelled button inside the widget-topbar-action marker', () => {
    render(<WidgetTopbarAction label="More" />);

    const button = screen.getByRole('button', { name: 'More' });

    expect(button.closest('.widget-topbar-action')).toBeTruthy();
  });

  it('keeps mousedown from the parent and still runs the caller handler', () => {
    const parentHandler = vi.fn();
    const ownHandler = vi.fn();
    render(
      <div onMouseDown={parentHandler}>
        <WidgetTopbarAction label="More" onMouseDown={ownHandler} />
      </div>,
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: 'More' }));

    expect(parentHandler).not.toHaveBeenCalled();
    expect(ownHandler).toHaveBeenCalledOnce();
  });

  it('works as a Radix trigger child', async () => {
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <WidgetTopbarAction label="More" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Item</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(await screen.findByRole('menuitem', { name: 'Item' })).toBeTruthy();
  });
});
