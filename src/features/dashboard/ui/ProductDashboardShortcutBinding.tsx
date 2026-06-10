import { useSideEffect } from '@/shared/di';
import { useTranslation } from '@/shared/translation';
import { productAddToDashboardSideEffect } from '@/features/browser';
import { triggerProductDashboardShortcut } from '../triggerProductDashboardShortcut';

// Registers Cmd/Ctrl+D handling for the dashboard feature (browser owns the shortcut wiring).
export const ProductDashboardShortcutBinding = () => {
  const { t } = useTranslation();

  useSideEffect(productAddToDashboardSideEffect, ({ productId }) => {
    void triggerProductDashboardShortcut(productId, t);
  });

  return null;
};
