import { type KeyboardEvent, useEffect, useState } from 'react';

type UseDropdownNavigationOptions<T> = {
  items: T[];
  onSelect: (item: T) => void;
};

export const useDropdownNavigation = <T>({ items, onSelect }: UseDropdownNavigationOptions<T>) => {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(-1);
  }, [items]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < items.length) {
      e.preventDefault();
      const item = items[activeIndex];
      if (item !== undefined) onSelect(item);
    }
  };

  return { activeIndex, handleKeyDown };
};
