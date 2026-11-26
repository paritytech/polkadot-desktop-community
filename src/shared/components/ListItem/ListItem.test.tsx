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

  it('renders no button without onClick', () => {
    render(<ListItem label="Wallet" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws a chevron', () => {
    const { container } = render(<ListItem label="Wallet" chevron />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('keeps a click on the action away from onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListItem label="Wallet" action={<button type="button">Remove</button>} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByText('Wallet'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders only the action button when the row has no onClick', () => {
    render(<ListItem label="Wallet" action={<button type="button">Remove</button>} />);

    expect(screen.getAllByRole('button')).toEqual([screen.getByRole('button', { name: 'Remove' })]);
  });

  it('marks the selected row as current', () => {
    render(<ListItem label="Wallet" selected onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Wallet' })).toHaveAttribute('aria-current', 'true');
  });

  it('disables the row button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListItem label="Wallet" disabled onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Wallet' });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('puts the title on the root button', () => {
    render(<ListItem label="Wallet" title="Opens the wallet" testId="row" onClick={vi.fn()} />);

    const root = screen.getByTestId('row');
    expect(root.tagName).toBe('BUTTON');
    expect(root).toHaveAttribute('title', 'Opens the wallet');
  });

  it('puts the title on the root div', () => {
    render(<ListItem label="Wallet" title="Opens the wallet" testId="row" />);

    const root = screen.getByTestId('row');
    expect(root.tagName).toBe('DIV');
    expect(root).toHaveAttribute('title', 'Opens the wallet');
  });

  it('truncates a string description in its wrapper', () => {
    render(<ListItem label="Wallet" description="wallet.dot" />);

    const wrapper = screen.getByText('wallet.dot');
    expect(wrapper).toHaveClass('truncate');
    expect(wrapper.children).toHaveLength(0);
  });

  it('truncates a description node that renders bare text', () => {
    const AppCount = () => <>3 apps</>;
    render(<ListItem label="Wallet" description={<AppCount />} />);

    expect(screen.getByText('3 apps')).toHaveClass('truncate');
  });

  it('renders each element of a description node as its own line in one wrapper', () => {
    render(
      <ListItem
        label="Chain"
        description={
          <>
            <span>wss://rpc.example</span>
            <span>0x1234…abcd</span>
          </>
        }
      />,
    );

    const wrapper = screen.getByText('wss://rpc.example').parentElement;
    expect(screen.getByText('0x1234…abcd').parentElement).toBe(wrapper);
    expect(wrapper?.children).toHaveLength(2);
  });

  it('puts testId on the root of a row with an action', () => {
    render(<ListItem label="Wallet" testId="row" action={<button type="button">Remove</button>} onClick={vi.fn()} />);

    const root = screen.getByTestId('row');
    expect(root.tagName).toBe('DIV');
    expect(root).toContainElement(screen.getByRole('button', { name: 'Remove' }));
    expect(root).toContainElement(screen.getByRole('button', { name: 'Wallet' }));
  });

  it('draws the focus ring of a row with an action over the whole row', () => {
    render(<ListItem label="Wallet" action={<button type="button">Remove</button>} onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Wallet' })).toHaveClass('focus-visible:after:outline-2');
  });
});
