// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '../DropdownMenu/DropdownMenu';

import { Button } from './Button';

describe('Button', () => {
  it('is a plain button by default', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('keeps a type the caller passes', () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('passes native attributes and ref through', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <Button ref={ref} aria-expanded data-testid="b" onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('data-testid', 'b');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('opts out of the app focus ring and merges a caller style with no-drag', () => {
    render(<Button style={{ color: 'red' }}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('data-no-app-focus');
    expect(button.style.color).toBe('red');
    expect(button.style.getPropertyValue('app-region')).toBe('no-drag');
  });

  it('blocks clicks while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps its own classes under a menu trigger', () => {
    render(
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button>Save</Button>
        </DropdownMenu.Trigger>
      </DropdownMenu.Root>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('inline-flex', 'rounded-full', 'h-control');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('looks checked as a ghost while expanded or pressed', () => {
    render(
      <Button variant="ghost" aria-expanded>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveClass(
      'aria-expanded:bg-chrome-fill-strong',
      'aria-expanded:shadow-chrome-raised',
      'aria-pressed:bg-chrome-fill-strong',
    );
  });
});
