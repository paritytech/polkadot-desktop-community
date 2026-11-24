// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWindowFocus } from './useWindowFocus';

describe('useWindowFocus', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'App');
  });

  it('follows the window focus', () => {
    const { result } = renderHook(() => useWindowFocus());

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(true);
  });

  it('follows the Electron window focus', () => {
    let listener: (focused: boolean) => void = () => {};
    const unsubscribe = vi.fn();
    Object.defineProperty(window, 'App', {
      configurable: true,
      value: {
        onWindowFocusChange: (cb: (focused: boolean) => void) => {
          listener = cb;
          return unsubscribe;
        },
      },
    });

    const { result, unmount } = renderHook(() => useWindowFocus());

    act(() => listener(false));
    expect(result.current).toBe(false);

    act(() => listener(true));
    expect(result.current).toBe(true);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
