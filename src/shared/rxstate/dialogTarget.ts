import { type RxState, createState } from './state';

export type DialogTarget<T> = {
  /** Nullable state: the open dialog's target value, or `null` when closed. */
  target: RxState<T | null>;
  open: (value: T) => void;
  close: () => void;
};

// A single-target dialog: nullable state plus `open`/`close`. A feature pairs
// one of these with a host component that reads `target` (via `useRxState`) and
// renders the matching dialog. Keeps the open/close boilerplate in one place.
export function createDialogTarget<T>(): DialogTarget<T> {
  const target = createState<T | null>(null);

  return {
    target,
    open: value => target.set(value),
    close: () => target.set(null),
  };
}
