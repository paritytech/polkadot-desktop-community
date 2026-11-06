import { Dialog } from '@novasamatech/tr-ui';
import { type PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/shared/translation';

/**
 * The single dialog shell every product request renders.
 *
 * `Root` owns exactly ONE Radix `Dialog` for the whole request. A request's steps
 * (summary → details, review → outcome) are **content swaps inside it**, never sibling
 * dialogs — mounting a second `Dialog` to change step tears down the overlay, restarts
 * the enter animation and drops focus, which reads as a flash between two different
 * modals.
 *
 * So: no request modal renders its own `Dialog`. A step that needs different dismissal
 * semantics registers them with `useDismissOverride` rather than wrapping itself in
 * another dialog.
 *
 * This is the `SSODialog` shell under a name that describes what it is. The old name
 * came from the host-papp `UserSession` it drove; the core owns that now, and what is
 * left is the shell for any request a product makes of the user.
 */

type ProductRequestDialogContextValue = {
  /** Lets the active step replace what Esc / the X button / an outside click do. */
  setDismissOverride: (handler: VoidFunction | null) => void;
};

const ProductRequestDialogContext = createContext<ProductRequestDialogContextValue | null>(null);

function useProductRequestDialogContext(component: string): ProductRequestDialogContextValue {
  const context = useContext(ProductRequestDialogContext);
  if (!context) {
    throw new Error(`ProductRequestDialog.${component} must be rendered inside ProductRequestDialog.Root`);
  }

  return context;
}

/**
 * Replace the dialog's dismissal behaviour for as long as the calling step is mounted.
 * Restores the `Root`-level handler on unmount. Takes the setter rather than reading
 * context itself so the caller can take context on its FIRST line — a step rendered
 * outside `Root` should report that, not an intl error.
 */
export function useDismissOverride(
  setDismissOverride: ProductRequestDialogContextValue['setDismissOverride'],
  handler: VoidFunction,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // Double arrow, deliberately: `setDismissOverride` is a state setter, so a bare
    // `() => handlerRef.current()` would be treated as a functional updater and INVOKED
    // on mount — denying the request the moment this step appears. The outer arrow
    // returns the handler; it does not call it.
    setDismissOverride(() => () => handlerRef.current());

    return () => setDismissOverride(null);
  }, [setDismissOverride]);
}

export { useProductRequestDialogContext };

type RootProps = PropsWithChildren<{
  /**
   * Esc / X, unless the active step overrides it. Dismissing never approves; the caller
   * decides whether it is a denial or no answer at all.
   */
  onDismiss: VoidFunction;
  /** `tall` for the review layouts that scroll; `default` for a single-question prompt. */
  variant?: 'default' | 'tall';
}>;

// Always open: a request renders `Root` only while it wants the dialog up, and closes it
// by unmounting. There is no `open={false}` state to model.
const Root = ({ onDismiss, variant = 'tall', children }: RootProps) => {
  const [dismissOverride, setDismissOverride] = useState<VoidFunction | null>(null);

  const context = useMemo<ProductRequestDialogContextValue>(() => ({ setDismissOverride }), []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      (dismissOverride ?? onDismiss)();
    }
  };

  return (
    <Dialog modal open onOpenChange={handleOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        showCloseButton
        variant={variant}
        onOpenAutoFocus={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <ProductRequestDialogContext.Provider value={context}>{children}</ProductRequestDialogContext.Provider>
      </Dialog.Content>
    </Dialog>
  );
};

/** The dialog's accessible name. Every step must render exactly one. */
const Title = ({ children }: PropsWithChildren) => (
  <Dialog.Title asChild>
    <h2 className="text-2xl leading-8 font-semibold text-fg-primary">{children}</h2>
  </Dialog.Title>
);

/** The sentence under the title that says what the request does. */
const Subtitle = ({ children }: PropsWithChildren) => (
  <Dialog.Description asChild>
    <p className="text-base leading-6 font-normal text-fg-primary">{children}</p>
  </Dialog.Description>
);

/** The paragraph block under a step's title, from translation keys. */
const BodyCopy = ({ lines }: { lines: string[] }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-0 text-base leading-6 font-normal text-fg-primary">
      {lines.map(line => (
        <p key={line} className="leading-6">
          {t(line)}
        </p>
      ))}
    </div>
  );
};

export const ProductRequestDialog = {
  Root,
  Title,
  Subtitle,
  BodyCopy,
};
