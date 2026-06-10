/**
 * Shared data-testid constants used by both React components and E2E tests.
 * Single source of truth — avoids maintaining ID strings in two places.
 */
export const TEST_IDS = {
  // Onboarding
  onboardingQrContainer: 'onboarding-qr-container',
  onboardingConnectionPanel: 'onboarding-connection-panel',
  onboardingRetryButton: 'onboarding-retry-button',
  onboardingSkip: 'onboarding-skip',

  // Signing Bot (autotest mode)
  signingBotPanel: 'signing-bot-panel',
  signingBotUrlInput: 'signing-bot-url-input',
  signingBotTokenInput: 'signing-bot-token-input',
  signingBotUsernameInput: 'signing-bot-username-input',
  signingBotConnect: 'signing-bot-connect',
  signingBotStatus: 'signing-bot-status',
  signingBotReachable: 'signing-bot-reachable',

  // Top Bar
  quickChatButton: 'quick-chat-button',
  quickChatPopover: 'quick-chat-popover',
  quickChatViewMoreButton: 'quick-chat-view-more-button',

  // Onboarding network selector
  networkButton: 'network-button',

  // Browser
  newTabButton: 'new-tab-button',
  addressBarInput: 'address-bar-input',
  addressBarInstallButton: 'address-bar-install-button',
  proceedInChatDialogConfirmButton: 'proceed-in-chat-dialog-confirm-button',
  browserRefreshButton: 'browser-refresh-button',
  findBar: 'find-bar',
  findInput: 'find-bar-input',
  findCount: 'find-bar-count',
  findNext: 'find-bar-next',
  findPrevious: 'find-bar-previous',
  findClose: 'find-bar-close',
  zoomIndicator: 'zoom-indicator',
  zoomPercent: 'zoom-indicator-percent',
  zoomIn: 'zoom-indicator-in',
  zoomOut: 'zoom-indicator-out',
  zoomReset: 'zoom-indicator-reset',

  // Signing
  submitErrorAlert: 'submit-error-alert',

  // Permission dialogs
  permissionDialogAllowAlways: 'permission-dialog-allow-always',
  aliasPermissionAllow: 'alias-permission-allow',

  // User Manager
  userButton: 'user-button',
  userLogoutButton: 'user-logout-button',
  userDisplayName: 'user-display-name',
  userSettingsAction: 'user-settings-action',
  userPopoverBanner: 'user-popover-banner',

  // Navigation
  homeButton: 'home-button',
  navigationBackButton: 'navigation-back-button',
  navigationForwardButton: 'navigation-forward-button',

  // Dashboard Toolbar
  dashboardEditModeToggle: 'dashboard-edit-mode-toggle',
  dashboardAddWidgetButton: 'dashboard-add-widget-button',
  dashboardPaginationTab: 'dashboard-pagination-tab',
  dashboardPager: 'dashboard-pager',

  // Chat Widget (on dashboard)
  chatWidget: 'chat-widget',
  chatWidgetFullscreenButton: 'chat-widget-fullscreen-button',
  productWidgetReloadButton: 'product-widget-reload-button',

  // Chat (fullscreen)
  chatRoomList: 'chat-room-list',
  chatMessageInput: 'chat-message-input',
  chatSendButton: 'chat-send-button',

  // Chat — P2P contact search (PB-217)
  chatSearchToggleButton: 'chat-search-toggle-button',
  chatRoomItem: 'chat-room-item',
  chatNewRequestsItem: 'chat-new-requests-item',
  chatRequestAcceptButton: 'chat-request-accept-button',
  chatQuickReactionsRow: 'chat-quick-reactions-row',
  chatReactionPill: 'chat-reaction-pill',
  contactSearchInput: 'contact-search-input',
  contactResultItem: 'contact-result-item',
  contactWelcomeInput: 'contact-welcome-input',
  contactSendRequestButton: 'contact-send-request-button',

  // Product Actions Menu
  productActionsMenuTrigger: 'product-actions-menu-trigger',
  productActionsMenuItem: 'product-actions-menu-item',
  productActionsMenuOpenSettings: 'product-actions-menu-open-settings',

  // Offline Access
  offlineAccessMenuItem: 'offline-access-menu-item',
  offlineAccessEnableConfirm: 'offline-access-enable-confirm',
  offlineAccessRemoveConfirm: 'offline-access-remove-confirm',
  offlineAccessPinIndicator: 'offline-access-pin-indicator',
  offlineAccessUpdateConfirm: 'offline-access-update-confirm',

  // Browser tabs
  tabHoverVersionPin: 'tab-hover-version-pin',

  // Permission settings
  permissionModalityRow: 'permission-modality-row',
  permissionResetButton: 'permission-reset-button',

  // Custom Chains settings
  customChainsEndpointInput: 'custom-chains-endpoint-input',
  customChainsNameInput: 'custom-chains-name-input',
  customChainsAddButton: 'custom-chains-add-button',
  customChainsEntry: 'custom-chains-entry',
  customChainsRemoveButton: 'custom-chains-remove-button',
} as const;
