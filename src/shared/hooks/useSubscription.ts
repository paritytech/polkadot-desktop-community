import { useCallback, useEffect, useRef } from 'react';

/**
 * Creates a subscription mechanism that notifies registered callbacks whenever the provided value changes.
 * Returns a function to register callbacks that will be invoked on value updates.
 *
 * @template T The type of the value being subscribed to
 * @param {T} value The value to monitor for changes
 * @return A subscription function that accepts a callback and returns an unsubscribe function
 */
export function useSubscription<T>(value: T) {
  const callbacks = useRef<((value: T) => void)[]>([]);

  useEffect(() => {
    for (const callback of callbacks.current) {
      callback(value);
    }
  }, [value]);

  return useCallback((callback: (value: T) => void) => {
    callbacks.current.push(callback);
    return () => (callbacks.current = callbacks.current.filter(x => x !== callback));
  }, []);
}
