import { Maximize2, MessageCircle } from 'lucide-react';
import { FormattedMessage } from 'react-intl';

import LastChatsIcon from '@/shared/assets/images/header/last-chats.svg?jsx';
import { createFeature } from '@/shared/feature';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { persistentSlot, topBarTrailingSlot } from '@/features/app-shell';
import { tabContentSlot, tabHoverSlot } from '@/features/browser';
import {
  type AddableDashboardCard,
  DashboardCardChrome,
  dashboardCardSDK,
  widgetTopbarActionButtonClass,
  widgetTopbarActionVisibilityClass,
} from '@/features/dashboard';
import { productActionsMenuItemsSlot } from '@/features/product-actions-menu';

import { CHAT_CARD_KIND, CHAT_CARD_LAYOUT_RULES } from './constants';
import { useOpenChatTab } from './hooks/useOpenChatTab';
import { CHAT } from './tabs';
import { ChatHeaderButton } from './ui/ChatHeaderButton';
import { ChatTabBinding } from './ui/ChatTabBinding';
import { ChatTabContent } from './ui/ChatTabContent';
import { ChatTabHover } from './ui/ChatTabHover';
import { ChatWidget } from './ui/ChatWidget';
import { ProceedInChatDialogHost } from './ui/ProceedInChatDialogHost';
import { ProceedInChatMenuItem } from './ui/ProceedInChatMenuItem';

export const chatFeature = createFeature({
  name: 'chat/implementation',
});

chatFeature.inject(topBarTrailingSlot, {
  order: 0,
  render: () => <ChatHeaderButton />,
});

const CHAT_TOPBAR_ICON = <LastChatsIcon className="size-6" aria-hidden />;

/** Icon slot content for add-widget sidebar/modal — parent components constrain size. */
const CHAT_ADD_WIDGET_ICON = <MessageCircle className="size-full" aria-hidden />;
const CHAT_LABEL = <FormattedMessage id="feature.chat.widgetTitle" />;

const chatAddableEntry: AddableDashboardCard = {
  kind: CHAT_CARD_KIND,
  gridId: 'chat',
  displayNameKey: 'feature.chat.title',
  icon: CHAT_ADD_WIDGET_ICON,
  defaultLayoutRules: CHAT_CARD_LAYOUT_RULES,
  widgetCard: {
    titleKey: 'feature.dashboard.addWidget.cards.chat.title',
    descriptionKey: 'feature.dashboard.addWidget.cards.chat.description',
    previewVariant: 'small',
    sizeVariants: ['small', 'medium', 'large'],
  },
  createCard: () => ({
    payload: { kind: CHAT_CARD_KIND },
    gridSize: { w: 1, h: 4 },
  }),
};

const ChatFullscreenAction = () => {
  const { t } = useTranslation();
  const openChatTab = useOpenChatTab();

  return (
    <span className={widgetTopbarActionVisibilityClass}>
      <button
        type="button"
        data-testid={TEST_IDS.chatWidgetFullscreenButton}
        aria-label={t('common.aria.openFullscreen')}
        className={widgetTopbarActionButtonClass}
        onClick={openChatTab}
        onMouseDown={event => event.stopPropagation()}
      >
        <Maximize2 className="size-4" aria-hidden />
      </button>
    </span>
  );
};

dashboardCardSDK(chatFeature, {
  content: props => {
    if (props.card.payload.kind !== CHAT_CARD_KIND) return null;
    return (
      <DashboardCardChrome
        card={props.card}
        width={props.width}
        height={props.height}
        layoutRules={CHAT_CARD_LAYOUT_RULES}
        isMenuOpen={props.isMenuOpen}
        onMenuOpenChange={open => props.onMenuOpenChange(props.menuId, open)}
        onResizeCard={props.onResizeCard}
        onRemoveCard={props.onRemoveCard}
        onCleanupCards={props.onCleanupCards}
      >
        <ChatWidget />
      </DashboardCardChrome>
    );
  },
  metadata: payload => (payload.kind === CHAT_CARD_KIND ? { icon: CHAT_TOPBAR_ICON, label: CHAT_LABEL } : null),
  actions: ({ payload }) => (payload.kind === CHAT_CARD_KIND ? <ChatFullscreenAction /> : null),
  addable: entries => [...entries, chatAddableEntry],
});

chatFeature.inject(tabContentSlot, ({ tab, isActive }) => (tab.type === CHAT ? <ChatTabContent isActive={isActive} /> : null));
chatFeature.inject(tabHoverSlot, ({ tab }) => (tab.type === CHAT ? <ChatTabHover /> : null));
chatFeature.inject(persistentSlot, () => <ChatTabBinding />);
chatFeature.inject(persistentSlot, () => <ProceedInChatDialogHost />);
chatFeature.inject(productActionsMenuItemsSlot, {
  order: 20,
  render: ({ productId, closeMenu }) => <ProceedInChatMenuItem productId={productId} closeMenu={closeMenu} />,
});
