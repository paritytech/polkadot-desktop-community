import { useEffect, useRef, useState } from 'react';

type UseFitCountOptions = {
  itemHeight: number;
  maxCount: number;
  defaultCount?: number;
};

export function useFitCount<T extends HTMLElement = HTMLDivElement>({
  itemHeight,
  maxCount,
  defaultCount = 1,
}: UseFitCountOptions) {
  const containerRef = useRef<T>(null);
  const [count, setCount] = useState(defaultCount);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCount = () => {
      const height = container.clientHeight;
      const calculated = Math.floor(height / itemHeight);
      setCount(Math.max(1, Math.min(calculated, maxCount)));
    };

    updateCount();

    const resizeObserver = new ResizeObserver(updateCount);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [itemHeight, maxCount]);

  return { containerRef, count };
}
