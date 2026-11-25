import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { type ComponentProps } from 'react';

import { Button } from '../Button/Button';
import { DialogCard, DialogFooter, DialogHeader, DialogHeading, DialogScrim, DialogText } from '../Dialog/DialogSurface';
import { BodyLockSweep } from '../_helpers/BodyLockSweep';

type AlertDialogContentProps = Omit<ComponentProps<typeof AlertDialogPrimitive.Content>, 'className' | 'asChild'>;

const AlertDialogContent = ({ children, ...props }: AlertDialogContentProps) => {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay asChild>
        <DialogScrim />
      </AlertDialogPrimitive.Overlay>
      <AlertDialogPrimitive.Content asChild {...props}>
        <DialogCard data-modal-surface>
          <BodyLockSweep />
          {children}
        </DialogCard>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
};

type AlertDialogTitleProps = Omit<ComponentProps<typeof AlertDialogPrimitive.Title>, 'className'>;

const AlertDialogTitle = ({ asChild, children, ...props }: AlertDialogTitleProps) => {
  return (
    <AlertDialogPrimitive.Title asChild {...props}>
      {asChild ? children : <DialogHeading>{children}</DialogHeading>}
    </AlertDialogPrimitive.Title>
  );
};

type AlertDialogDescriptionProps = Omit<ComponentProps<typeof AlertDialogPrimitive.Description>, 'className'>;

const AlertDialogDescription = ({ asChild, children, ...props }: AlertDialogDescriptionProps) => {
  return (
    <AlertDialogPrimitive.Description asChild {...props}>
      {asChild ? children : <DialogText>{children}</DialogText>}
    </AlertDialogPrimitive.Description>
  );
};

type AlertDialogCancelProps = Omit<ComponentProps<typeof Button>, 'variant'>;

const AlertDialogCancel = (props: AlertDialogCancelProps) => {
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button {...props} />
    </AlertDialogPrimitive.Cancel>
  );
};

type AlertDialogActionProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  variant?: 'primary' | 'danger';
};

const AlertDialogAction = ({ variant = 'primary', ...props }: AlertDialogActionProps) => {
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button variant={variant} {...props} />
    </AlertDialogPrimitive.Action>
  );
};

/** dot.li's confirmation modal over Radix: the dialog's glass card with a cancel and an action, no close button. */
export const AlertDialog = {
  Root: AlertDialogPrimitive.Root,
  Content: AlertDialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: AlertDialogTitle,
  Description: AlertDialogDescription,
  Cancel: AlertDialogCancel,
  Action: AlertDialogAction,
};
