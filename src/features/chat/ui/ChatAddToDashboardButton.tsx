import { useLocation } from '@tanstack/react-router';

import LayoutDashboardIcon from '@/shared/assets/images/icons/layout-dashboard.svg?jsx';
import MessageCircleIcon from '@/shared/assets/images/icons/message-circle.svg?jsx';
import { IconButton } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { productAddToDashboardSideEffect } from '@/features/browser';
import { CHAT, isChatPathname } from '../tabs';

// Leading address-bar affordance for the chat SPA. Chat is native (no product),
// so it gets a direct "Add to Dashboard" button instead of the product ••• menu.
// Firing the shared side effect reuses the exact path as Cmd/Ctrl+D.
export const ChatAddToDashboardButton = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  // The leading slot renders for every product id; this affordance is chat-only.
  if (!isChatPathname(pathname)) return null;

  return (
    <span className="-ms-2 -me-1 flex">
      <IconButton
        size="sm"
        label={t('feature.dashboard.addToDashboard.label')}
        data-testid={TEST_IDS.chatAddToDashboardButton}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          void productAddToDashboardSideEffect.apply({ productId: CHAT });
        }}
      >
        <LayoutDashboardIcon />
      </IconButton>
    </span>
  );
};

// Leading address-bar identity icon for the chat SPA. Chat is native (no product
// row → no favicon), so it supplies its own chat bubble, tinted with the
// URL text color so it flips with the theme (dark in light, light in dark).
export const ChatAddressBarIcon = () => <MessageCircleIcon className="size-4 text-chrome-text" />;
