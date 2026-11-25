import { toast as sonnerToast } from 'sonner';

import { type ToastTone, ToastCard } from './ToastCard';

export type ToastContent = {
  title: string;
  description?: string;
  id?: string;
  duration?: number;
  action?: { label: string; onClick: VoidFunction };
  onDismiss?: VoidFunction;
};

function show(tone: ToastTone, { id, duration, onDismiss, action, ...card }: ToastContent): void {
  // A custom toast can only leave through toast.dismiss, which runs onDismiss; an action is not a dismissal.
  let acted = false;

  sonnerToast.custom(
    toastId => (
      <ToastCard
        tone={tone}
        {...card}
        action={
          action && {
            label: action.label,
            onClick: () => {
              acted = true;
              action.onClick();
              sonnerToast.dismiss(toastId);
            },
          }
        }
        onClose={() => sonnerToast.dismiss(toastId)}
      />
    ),
    {
      // sonner's custom spreads these options over the id it hands the card, so an `id: undefined` would replace it.
      ...(id ? { id } : {}),
      duration,
      onDismiss: () => {
        if (!acted) onDismiss?.();
      },
    },
  );
}

export const toast = {
  success: (content: ToastContent) => show('success', content),
  error: (content: ToastContent) => show('error', content),
  info: (content: ToastContent) => show('info', content),
  message: (content: ToastContent) => show('message', content),
};
