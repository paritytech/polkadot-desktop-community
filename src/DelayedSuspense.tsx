import { type ComponentType, lazy, use, useEffect } from 'react';

/**
 * React.lazy wrapper with additional onReady callback. Only components with no
 * props supported.
 */
export const controlledLazy = (fn: () => Promise<ComponentType<object>>) => {
  return lazy(async () => {
    const Component = await fn();
    const Wrapper = ({ onReady }: { onReady: VoidFunction }) => {
      useEffect(() => {
        onReady();
      }, []);

      return <Component />;
    };

    return { default: Wrapper };
  });
};

/**
 * Wait for promise resolving
 */
export const LoadingDelay = ({ suspense }: { suspense: Promise<unknown> }) => {
  use(suspense);

  return null;
};
