import { useCallback, useState } from 'react';

/**
 * Toggles initial value to opposite
 *
 * @param initialValue Value to toggle
 *
 * @returns {Array}
 */
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback((override?: boolean) => {
    setValue(value => override ?? !value);
  }, []);

  return [value, toggle];
}
