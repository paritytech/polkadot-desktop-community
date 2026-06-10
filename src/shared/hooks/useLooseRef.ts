import { useMemo, useRef } from 'react';

/**
 * Saves value outside of React rendering cycle and returns getter function.
 * Similar to useRef + `ref.current = value` with simpler api.
 *
 * @param value - Value to save, will rewrite older value on each rerender.
 */
export const useLooseRef = <V>(value: V) => {
  const ref = useRef<V>(value);
  ref.current = value;

  return useMemo(
    () => () => {
      return ref.current;
    },
    [],
  );
};
