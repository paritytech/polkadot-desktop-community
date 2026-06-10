import {
  type PropsWithChildren,
  type ReactNode,
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { promiseWithResolvers } from '@/shared/utils';

type ConfirmationControls<T> = { resolve: (value: T) => void; reject: (reason?: unknown) => void };
type ConfirmationRender<T> = (controls: ConfirmationControls<T>) => ReactNode;

type ConfirmFn = <T = void>(id: string, render: ConfirmationRender<T>) => Promise<T>;

type ConfirmationEntry = {
  id: string;
  render: () => ReactNode;
  reject: (reason?: unknown) => void;
};

type ContextValue = {
  confirm: ConfirmFn;
  dispose: (id: string) => void;
};

const ConfirmationContext = createContext<ContextValue | null>(null);

export const ConfirmationProvider = ({ children }: PropsWithChildren) => {
  const [entries, setEntries] = useState<ConfirmationEntry[]>([]);

  const confirm = useCallback(<T,>(id: string, render: ConfirmationRender<T>): Promise<T> => {
    const { promise, resolve, reject } = promiseWithResolvers<T>();

    const entry: ConfirmationEntry = {
      id,
      render: () => render({ resolve, reject }),
      reject,
    };

    setEntries(prev => {
      const existing = prev.find(e => e.id === id);
      existing?.reject(new Error(`Confirmation "${id}" was replaced`));
      return [...prev.filter(e => e.id !== id), entry];
    });

    return promise.finally(() => setEntries(prev => prev.filter(e => e.id !== id)));
  }, []);

  const dispose = useCallback((id: string) => {
    setEntries(prev => {
      const existing = prev.find(e => e.id === id);
      if (!existing) return prev;
      existing.reject(new Error(`Confirmation "${id}" was disposed`));
      return prev.filter(e => e.id !== id);
    });
  }, []);

  const value = useMemo<ContextValue>(() => ({ confirm, dispose }), [confirm, dispose]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {entries.map(entry => (
        <Fragment key={entry.id}>{entry.render()}</Fragment>
      ))}
    </ConfirmationContext.Provider>
  );
};

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within ConfirmationProvider');
  }

  const { confirm, dispose } = context;
  const pendingIds = useRef(new Set<string>()).current;

  useEffect(
    () => () => {
      for (const id of pendingIds) dispose(id);
      pendingIds.clear();
    },
    [dispose, pendingIds],
  );

  return useCallback<ConfirmFn>(
    (id, render) => {
      pendingIds.add(id);
      return confirm(id, render).finally(() => pendingIds.delete(id));
    },
    [confirm, pendingIds],
  );
};
