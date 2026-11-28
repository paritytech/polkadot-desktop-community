import { FormattedMessage } from 'react-intl';

import LastChatsIcon from '@/shared/assets/images/header/last-chats.svg?jsx';
import { Sidebar } from '@/shared/components';
import { createFeature } from '@/shared/feature';
import { Maximize2Icon, MessageCircleIcon } from '@/shared/icons';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type ContentCardPayload, cardsUseCase, foldersUseCase } from '@/domains/application';
import { persistentSlot, topBarCenterLeadingSlot } from '@/features/app-shell';
import { addressBarProductLeadingSlot, resolveAddressBarProductIconTransformer, tabContentSlot } from '@/features/browser';
import { type AddableDashboardCard, WidgetTopbarAction, buildNativeDashboardCard, dashboardCardSDK } from '@/features/dashboard';
import { productActionsMenuItemsSlot } from '@/features/product-actions-menu';
import { settingsPreferencesNavSlot } from '@/features/settings';

import { CHAT_CARD_KIND, CHAT_CARD_LAYOUT_RULES, CHAT_WIDGET_CARD_ID } from './constants';
import { useOpenChatTab } from './hooks/useOpenChatTab';
import { CHAT } from './tabs';
import { ChatAddToDashboardButton, ChatAddressBarIcon } from './ui/ChatAddToDashboardButton';
import { ChatFavoriteOpenBinding } from './ui/ChatFavoriteOpenBinding';
import { ChatHeaderButton } from './ui/ChatHeaderButton';
import { ChatTabBinding } from './ui/ChatTabBinding';
import { ChatTabContent } from './ui/ChatTabContent';
import { ChatWidgetContent } from './ui/ChatWidgetContent';
import { ProceedInChatMenuItem } from './ui/ProceedInChatMenuItem';

export const chatFeature = createFeature({
  name: 'chat/implementation',
});

chatFeature.inject(topBarCenterLeadingSlot, {
  order: 0,
  render: () => <ChatHeaderButton />,
});

chatFeature.inject(settingsPreferencesNavSlot, {
  order: 1,
  render: () => {
    const { t } = useTranslation();

    return (
      <Sidebar.Item icon={<MessageCircleIcon />} to="/settings/chats">
        {t('feature.chat.settings.title')}
      </Sidebar.Item>
    );
  },
});

chatFeature.inject(addressBarProductLeadingSlot, {
  order: 0,
  render: () => <ChatAddToDashboardButton />,
});

// Chat is native (no product row → no favicon), so it supplies its own address-bar
// leading icon: a chat bubble tinted with the URL text color for both themes.
chatFeature.inject(resolveAddressBarProductIconTransformer, ({ productId }) =>
  productId === CHAT ? <ChatAddressBarIcon /> : null,
);

// Two-tone tile authored for light theme (dark tile, white bubble); invert it in
// dark theme so it flips with the theme like the Favourites/Settings icons.
const CHAT_TOPBAR_ICON = <LastChatsIcon className="size-6 dark:invert" aria-hidden />;

/** Icon slot content for add-widget sidebar/modal — parent components constrain size. */
const CHAT_ADD_WIDGET_ICON = <MessageCircleIcon className="size-full" />;
const CHAT_LABEL = <FormattedMessage id="feature.chat.widgetTitle" />;

const chatAddableEntry: AddableDashboardCard = {
  kind: CHAT_CARD_KIND,
  gridId: CHAT,
  // Distinct from the favourite id (`CHAT`) so favouriting chat doesn't strip the widget card.
  widgetGridId: CHAT_WIDGET_CARD_ID,
  displayNameKey: 'feature.chat.title',
  icon: CHAT_ADD_WIDGET_ICON,
  defaultLayoutRules: CHAT_CARD_LAYOUT_RULES,
  supportsFavorites: true,
  openFromFavorites: true,
  widgetCard: {
    titleKey: 'feature.dashboard.addWidget.cards.chat.title',
    descriptionKey: 'feature.dashboard.addWidget.cards.chat.description',
    previewVariant: 'small',
    sizeVariants: ['small', 'medium', 'large'],
  },
  createCard: () => ({
    payload: { kind: CHAT_CARD_KIND } satisfies ContentCardPayload,
    gridSize: { w: 1, h: 4 },
  }),
};

const ChatFullscreenAction = () => {
  const { t } = useTranslation();
  const openChatTab = useOpenChatTab();

  return (
    <WidgetTopbarAction
      data-testid={TEST_IDS.chatWidgetFullscreenButton}
      label={t('common.aria.openFullscreen')}
      onClick={openChatTab}
    >
      <Maximize2Icon />
    </WidgetTopbarAction>
  );
};

dashboardCardSDK(chatFeature, {
  content: props => {
    if (props.card.payload.kind !== CHAT_CARD_KIND) return null;
    return <ChatWidgetContent {...props} />;
  },
  metadata: payload => (payload.kind === CHAT_CARD_KIND ? { icon: CHAT_TOPBAR_ICON, label: CHAT_LABEL } : null),
  actions: ({ payload }) => (payload.kind === CHAT_CARD_KIND ? <ChatFullscreenAction /> : null),
  addable: entries => [...entries, chatAddableEntry],
  // Plain handler — adding is a pure data op over domain use cases, no React.
  add: request => {
    if ('product' in request || request.kind !== CHAT_CARD_KIND) return null;
    return request.size.w === 1 && request.size.h === 1
      ? foldersUseCase.addToFavorites(request.entry.gridId)
      : cardsUseCase.addCardToLayout(buildNativeDashboardCard(request.entry, request.size));
  },
});

chatFeature.inject(tabContentSlot, ({ tab, isActive }) => (tab.type === CHAT ? <ChatTabContent isActive={isActive} /> : null));
chatFeature.inject(persistentSlot, () => <ChatTabBinding />);
chatFeature.inject(persistentSlot, () => <ChatFavoriteOpenBinding />);
chatFeature.inject(productActionsMenuItemsSlot, {
  order: 20,
  render: ({ productId, closeMenu }) => <ProceedInChatMenuItem productId={productId} closeMenu={closeMenu} />,
});
