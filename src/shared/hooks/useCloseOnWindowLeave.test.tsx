// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCloseOnWindowLeave } from './useCloseOnWindowLeave';

describe('useCloseOnWindowLeave', () => {
  it.each(['blur', 'resize'])('closes on window %s while open', type => {
    const close = vi.fn();
    renderHook(() => useCloseOnWindowLeave(true, close));

    window.dispatchEvent(new Event(type));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each(['blur', 'resize'])('ignores window %s while closed', type => {
    const close = vi.fn();
    renderHook(() => useCloseOnWindowLeave(false, close));

    window.dispatchEvent(new Event(type));

    expect(close).not.toHaveBeenCalled();
  });

  it('starts listening after opening', () => {
    const close = vi.fn();
    const { rerender } = renderHook(({ open }) => useCloseOnWindowLeave(open, close), {
      initialProps: { open: false },
    });

    rerender({ open: true });
    window.dispatchEvent(new Event('blur'));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('stops listening after closing', () => {
    const close = vi.fn();
    const { rerender } = renderHook(({ open }) => useCloseOnWindowLeave(open, close), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('resize'));

    expect(close).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const close = vi.fn();
    const { unmount } = renderHook(() => useCloseOnWindowLeave(true, close));

    unmount();
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('resize'));

    expect(close).not.toHaveBeenCalled();
  });

  it('calls the latest close', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ close }) => useCloseOnWindowLeave(true, close), {
      initialProps: { close: first },
    });

    rerender({ close: second });
    window.dispatchEvent(new Event('blur'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
