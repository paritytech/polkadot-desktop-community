// @vitest-environment happy-dom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

type Props = {
  value: Nullable<string>;
  onChange?: (value: string) => void;
  holdIndicator?: boolean;
  values?: string[];
  disabled?: string[];
};

const Things = ({ value, onChange = vi.fn(), holdIndicator, values = ['a', 'b', 'c'], disabled = [] }: Props) => (
  <SegmentedControl.Root label="Things" value={value} holdIndicator={holdIndicator} onChange={onChange}>
    {values.map(item => (
      <SegmentedControl.Item key={item} value={item} disabled={disabled.includes(item)}>
        {item.toUpperCase()}
      </SegmentedControl.Item>
    ))}
  </SegmentedControl.Root>
);

const item = (name: string) => screen.getByRole('button', { name });

const indicator = () => {
  const element = document.querySelector('[data-segment-indicator]');
  if (element === null) throw new Error('The indicator is not rendered');
  return element;
};

const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

const measureItemsAs = (width: number, height: number) => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
};

describe('SegmentedControl', () => {
  beforeEach(() => {
    measureItemsAs(40, 24);
  });

  afterEach(() => {
    if (originalWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalWidth);
    if (originalHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalHeight);
  });

  it('presses the item whose value is the value', () => {
    render(<Things value="b" />);

    expect(screen.getByRole('group', { name: 'Things' })).toBeInTheDocument();
    expect(item('A')).toHaveAttribute('aria-pressed', 'false');
    expect(item('B')).toHaveAttribute('aria-pressed', 'true');
    expect(item('C')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with a newly picked value only', () => {
    const onChange = vi.fn();
    render(<Things value="b" onChange={onChange} />);

    fireEvent.click(item('C'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('c');

    fireEvent.click(item('B'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is one tab stop', async () => {
    render(<Things value="b" />);

    await waitFor(() => expect(item('B')).toHaveAttribute('tabIndex', '0'));
    expect(item('A')).toHaveAttribute('tabIndex', '-1');
    expect(item('C')).toHaveAttribute('tabIndex', '-1');
  });

  it('moves focus with the arrow keys, Home and End without picking', () => {
    const onChange = vi.fn();
    render(<Things value="b" onChange={onChange} />);

    act(() => item('B').focus());
    fireEvent.keyDown(item('B'), { key: 'ArrowRight' });
    expect(item('C')).toHaveFocus();
    fireEvent.keyDown(item('C'), { key: 'ArrowRight' });
    expect(item('A')).toHaveFocus();
    fireEvent.keyDown(item('A'), { key: 'End' });
    expect(item('C')).toHaveFocus();
    fireEvent.keyDown(item('C'), { key: 'Home' });
    expect(item('A')).toHaveFocus();
    fireEvent.keyDown(item('A'), { key: 'ArrowLeft' });
    expect(item('C')).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('picks the focused item with Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Things value="b" onChange={onChange} />);

    await user.tab();
    expect(item('B')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('places the indicator under the pressed item', async () => {
    render(<Things value="b" />);

    await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));
    expect(item('B')).not.toHaveAttribute('data-filled');
  });

  it('holds the indicator while holdIndicator is set', async () => {
    render(<Things value="b" holdIndicator />);

    await waitFor(() => expect(item('B')).toHaveAttribute('data-filled'));
    expect(indicator()).not.toHaveAttribute('data-placed');
  });

  it('places the indicator again when the hold ends', async () => {
    const { rerender } = render(<Things value="b" holdIndicator />);
    await waitFor(() => expect(item('B')).toHaveAttribute('data-filled'));

    rerender(<Things value="b" />);

    await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));
    expect(item('B')).not.toHaveAttribute('data-filled');
  });

  it('leaves the indicator unplaced when the item measures zero', async () => {
    measureItemsAs(0, 0);
    render(<Things value="b" />);

    await waitFor(() => expect(item('B')).toHaveAttribute('data-filled'));
    expect(indicator()).not.toHaveAttribute('data-placed');
  });

  it('places the indicator on an item added after mount', async () => {
    const { rerender } = render(<Things value="b" />);
    await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));

    rerender(<Things value="d" />);
    await waitFor(() => expect(indicator()).not.toHaveAttribute('data-placed'));
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();

    rerender(<Things value="d" values={['a', 'b', 'c', 'd']} />);
    await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));
    expect(item('D')).toHaveAttribute('aria-pressed', 'true');
  });

  it('presses nothing and makes the first item the only stop when value is null', async () => {
    const { rerender } = render(<Things value={null} />);

    await waitFor(() => expect(item('A')).toHaveAttribute('tabIndex', '0'));
    expect(item('B')).toHaveAttribute('tabIndex', '-1');
    expect(item('C')).toHaveAttribute('tabIndex', '-1');
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    expect(indicator()).not.toHaveAttribute('data-placed');

    rerender(<Things value="z" />);

    await waitFor(() => expect(item('A')).toHaveAttribute('tabIndex', '0'));
    expect(item('B')).toHaveAttribute('tabIndex', '-1');
    expect(item('C')).toHaveAttribute('tabIndex', '-1');
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
    expect(indicator()).not.toHaveAttribute('data-placed');
  });

  it('does not pick a disabled item', () => {
    const onChange = vi.fn();
    render(<Things value="a" disabled={['b']} onChange={onChange} />);

    fireEvent.click(item('B'));

    expect(item('B')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('skips a disabled item with the arrow keys, Home and End', () => {
    const { unmount } = render(<Things value="a" disabled={['b']} />);
    act(() => item('A').focus());
    fireEvent.keyDown(item('A'), { key: 'ArrowRight' });
    expect(item('C')).toHaveFocus();
    unmount();

    const { unmount: unmountEnd } = render(<Things value="a" disabled={['c']} />);
    act(() => item('A').focus());
    fireEvent.keyDown(item('A'), { key: 'End' });
    expect(item('B')).toHaveFocus();
    unmountEnd();

    render(<Things value="c" disabled={['a']} />);
    act(() => item('C').focus());
    fireEvent.keyDown(item('C'), { key: 'Home' });
    expect(item('B')).toHaveFocus();
  });

  it('leaves no Tab stop and moves nothing when every item is disabled', async () => {
    const onChange = vi.fn();
    render(<Things value="b" disabled={['a', 'b', 'c']} onChange={onChange} />);

    await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));
    for (const name of ['A', 'B', 'C']) {
      expect(item(name)).toHaveAttribute('tabIndex', '-1');
    }
    fireEvent.click(item('A'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('puts the Tab stop on the first enabled item when the pressed one is disabled', async () => {
    render(<Things value="a" disabled={['a']} />);

    await waitFor(() => expect(item('B')).toHaveAttribute('tabIndex', '0'));
    expect(item('A')).toHaveAttribute('tabIndex', '-1');
    expect(item('C')).toHaveAttribute('tabIndex', '-1');
  });

  it('swaps ArrowLeft and ArrowRight in a right-to-left layout', () => {
    render(
      <div style={{ direction: 'rtl' }}>
        <Things value="b" />
      </div>,
    );

    act(() => item('B').focus());
    fireEvent.keyDown(item('B'), { key: 'ArrowLeft' });

    expect(item('C')).toHaveFocus();
  });

  it('keeps one tab stop when the focused item is removed', async () => {
    const { rerender } = render(<Things value="b" />);
    act(() => item('C').focus());
    await waitFor(() => expect(item('C')).toHaveAttribute('tabIndex', '0'));

    rerender(<Things value="b" values={['a', 'b']} />);

    await waitFor(() => expect(item('B')).toHaveAttribute('tabIndex', '0'));
    expect(item('A')).toHaveAttribute('tabIndex', '-1');
  });

  it('re-measures the indicator when the rail resizes', async () => {
    const callbacks: VoidFunction[] = [];
    class ResizeObserverDouble {
      constructor(callback: VoidFunction) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    }
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ResizeObserverDouble as unknown as typeof ResizeObserver;

    try {
      render(<Things value="b" />);
      await waitFor(() => expect(indicator()).toHaveAttribute('data-placed'));
      expect(indicator()).toHaveStyle({ width: '40px' });

      measureItemsAs(60, 24);
      act(() => {
        for (const callback of callbacks) callback();
      });

      expect(indicator()).toHaveStyle({ width: '60px' });
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it('hands the rail element to an object railRef', () => {
    const railRef = createRef<HTMLDivElement>();
    render(
      <SegmentedControl.Root label="Things" value="a" railRef={railRef} onChange={vi.fn()}>
        <SegmentedControl.Item value="a">A</SegmentedControl.Item>
      </SegmentedControl.Root>,
    );

    expect(railRef.current).toBe(item('A').parentElement);
  });

  it('hands the rail element to a callback railRef', () => {
    const railRef = vi.fn();
    render(
      <SegmentedControl.Root label="Things" value="a" railRef={railRef} onChange={vi.fn()}>
        <SegmentedControl.Item value="a">A</SegmentedControl.Item>
      </SegmentedControl.Root>,
    );

    expect(railRef).toHaveBeenCalledWith(item('A').parentElement);
  });

  it('throws when an item is rendered outside the root', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<SegmentedControl.Item value="a">A</SegmentedControl.Item>)).toThrow(
      'SegmentedControl.Item must be rendered inside SegmentedControl.Root',
    );

    error.mockRestore();
  });
});
