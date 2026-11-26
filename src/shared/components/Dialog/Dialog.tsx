import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ComponentProps } from 'react';

import { useTranslation } from '@/shared/translation';
import { IconButton } from '../IconButton/IconButton';
import { BodyLockSweep } from '../_helpers/BodyLockSweep';

import { DialogCard, DialogFooter, DialogHeader, DialogHeading, DialogScrim, DialogText } from './DialogSurface';

type DialogContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, 'className' | 'asChild'> & {
  width?: 'sm' | 'md' | 'lg' | 'xl';
  height?: 'content' | 'tall';
  showCloseButton?: boolean;
};

const DialogContent = ({ width, height, showCloseButton = true, children, ...props }: DialogContentProps) => {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <DialogScrim />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content asChild {...props}>
        <DialogCard width={width} height={height} data-modal-surface data-closable={showCloseButton || undefined}>
          <BodyLockSweep />
          {children}
          {showCloseButton && (
            <span className="absolute end-3 top-3">
              <DialogPrimitive.Close asChild>
                <IconButton label={t('common.aria.close')}>
                  <X />
                </IconButton>
              </DialogPrimitive.Close>
            </span>
          )}
        </DialogCard>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

type DialogTitleProps = Omit<ComponentProps<typeof DialogPrimitive.Title>, 'className'>;

const DialogTitle = ({ asChild, children, ...props }: DialogTitleProps) => {
  return (
    <DialogPrimitive.Title asChild {...props} className="group-data-[closable]/dialog:pe-8">
      {asChild ? children : <DialogHeading>{children}</DialogHeading>}
    </DialogPrimitive.Title>
  );
};

type DialogDescriptionProps = Omit<ComponentProps<typeof DialogPrimitive.Description>, 'className'>;

const DialogDescription = ({ asChild, children, ...props }: DialogDescriptionProps) => {
  return (
    <DialogPrimitive.Description asChild {...props}>
      {asChild ? children : <DialogText>{children}</DialogText>}
    </DialogPrimitive.Description>
  );
};

/** dot.li's modal over Radix: a glass card over a scrim, with a close button in its corner unless dropped. */
export const Dialog = {
  Root: DialogPrimitive.Root,
  Close: DialogPrimitive.Close,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
};
