import { useLocation } from '@tanstack/react-router';
import { LayoutDashboard } from 'lucide-react';

import ChatBubbleOvalLeftIcon from '@/shared/assets/images/header/chat-bubble-oval-left.svg?jsx';
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
    <button
      type="button"
      aria-label={t('feature.dashboard.addToDashboard.label')}
      data-testid={TEST_IDS.chatAddToDashboardButton}
      data-no-app-focus
      className="-ms-2 -me-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 hover:bg-chrome-fill focus-visible:outline-2 focus-visible:outline-chrome-focus"
      onMouseDown={event => event.preventDefault()}
      onClick={() => {
        void productAddToDashboardSideEffect.apply({ productId: CHAT });
      }}
    >
      <LayoutDashboard className="size-4" aria-hidden />
    </button>
  );
};

// Leading address-bar identity icon for the chat SPA. Chat is native (no product
// row → no favicon), so it supplies its own filled chat bubble, tinted with the
// URL text color so it flips with the theme (dark in light, light in dark).
export const ChatAddressBarIcon = () => <ChatBubbleOvalLeftIcon className="size-4 text-chrome-text" aria-hidden />;
