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
  onboardingCompletingPairing: 'onboarding-completing-pairing',
  onboardingPairingError: 'onboarding-pairing-error',

  // Top Bar
  quickChatButton: 'quick-chat-button',
  quickChatPopover: 'quick-chat-popover',
  quickChatExpandButton: 'quick-chat-expand-button',
  chatSyncStatusBanner: 'chat-sync-status-banner',

  // Input modality spotlight surface
  inputModalitySurface: 'input-modality-surface',
  inputModalityInput: 'input-modality-input',
  inputModalityFileInput: 'input-modality-file-input',
  inputModalityNoCandidates: 'input-modality-no-candidates',
  inputModalityNoContext: 'input-modality-no-context',
  inputModalityScanButton: 'input-modality-scan-button',
  inputModalityScanner: 'input-modality-scanner',
  inputModalityScanConfirm: 'input-modality-scan-confirm',
  inputModalityGhostSuffix: 'input-modality-ghost-suffix',
  inputModalitySuggestions: 'input-modality-suggestions',
  inputModalityRecentsSection: 'input-modality-recents-section',
  inputModalitySavedSection: 'input-modality-saved-section',
  inputModalityCandidate: 'input-modality-candidate',
  inputModalityAttachment: 'input-modality-attachment',
  inputModalityPicker: 'input-modality-picker',
  inputModalityPickerOption: 'input-modality-picker-option',

  // Transparent overlay that dismisses an open top-bar popover on outside press
  dismissOverlay: 'dismiss-overlay',

  // Onboarding network selector
  networkButton: 'network-button',

  // Browser
  newTabButton: 'new-tab-button',
  addressBarInput: 'address-bar-input',
  addressBarInstallButton: 'address-bar-install-button',
  addressBarLoadingBar: 'address-bar-loading-bar',
  browserRefreshButton: 'browser-refresh-button',
  findBar: 'find-bar',
  findInput: 'find-bar-input',
  findCount: 'find-bar-count',
  findNext: 'find-bar-next',
  findPrevious: 'find-bar-previous',
  findClose: 'find-bar-close',
  zoomIndicator: 'zoom-indicator',
  swipeNavigationIndicator: 'swipe-navigation-indicator',
  zoomPercent: 'zoom-indicator-percent',
  zoomIn: 'zoom-indicator-in',
  zoomOut: 'zoom-indicator-out',
  zoomReset: 'zoom-indicator-reset',

  // The deny button of any product request — every modal's footer carries it, so a test
  // can decline a request without knowing which of the eleven it is looking at.
  productRequestDeny: 'product-request-deny',

  // Sign Payload / Create Transaction review screen (shared by SignPayloadModal & CreateTransactionModal)
  signReviewCallTitle: 'sign-review-call-title',
  signReviewAccount: 'sign-review-account',
  signReviewNetwork: 'sign-review-network',
  signReviewMoreDetails: 'sign-review-more-details',
  signReviewArguments: 'sign-review-arguments',
  signReviewCallData: 'sign-review-call-data',
  signReviewCustomChainWarning: 'sign-review-custom-chain-warning',
  signReviewBatchHint: 'sign-review-batch-hint',
  signReviewContinueButton: 'sign-review-continue-button',

  // Permission dialogs
  // `RemotePermissionRequestDialog` is the app's single permission surface: it answers
  // both the core's device/remote prompt and the host's own remote-URL interception.
  // Deny, allow-once and allow-always are always rendered.
  permissionDialogAllowAlways: 'permission-dialog-allow-always',
  permissionDialogAllowOnce: 'permission-dialog-allow-once',
  permissionDialogDeny: 'permission-dialog-deny',
  accountAccessDialog: 'account-access-dialog',
  accountAccessAllow: 'account-access-allow',
  productSubtreeDialog: 'product-subtree-dialog',
  productSubtreeAllow: 'product-subtree-allow',
  aliasPermissionAllow: 'alias-permission-allow',
  aliasPermissionDialog: 'alias-permission-dialog',
  identityDisclosureAllow: 'identity-disclosure-allow',
  identityDisclosureDialog: 'identity-disclosure-dialog',
  proofPermissionAllow: 'proof-permission-allow',
  proofPermissionDialog: 'proof-permission-dialog',
  signVrfAllow: 'sign-vrf-allow',
  signVrfDialog: 'sign-vrf-dialog',
  allocationRequestDialog: 'allocation-request-dialog',

  // Appearance settings
  themePreview: 'theme-preview',

  // User Manager
  userButton: 'user-button',
  userConnectionStatus: 'user-connection-status',
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

  // Dashboard layout & cards
  dashboardGrid: 'dashboard-grid',
  dashboardEmptyState: 'dashboard-empty-state',
  dashboardEmptyStateAddWidget: 'dashboard-empty-state-add-widget',
  dashboardProductWidget: 'dashboard-product-widget',
  dashboardFavoritesFolder: 'dashboard-favorites-folder',
  dashboardFavoriteIcon: 'dashboard-favorite-icon',
  dashboardFavoritesViewMore: 'dashboard-favorites-view-more',
  dashboardWidgetMenuTrigger: 'dashboard-widget-menu-trigger',
  dashboardWidgetMenuRemove: 'dashboard-widget-menu-remove',
  dashboardWidgetFullscreenButton: 'dashboard-widget-fullscreen-button',

  // Favorites (fullscreen SPA)
  favoritesWidgetFullscreenButton: 'favorites-widget-fullscreen-button',
  favoritesFullscreen: 'favorites-fullscreen',
  favoritesSearchInput: 'favorites-search-input',
  favoritesCard: 'favorites-card',
  favoritesCardRemove: 'favorites-card-remove',
  favoritesEmptyState: 'favorites-empty-state',
  favoritesSearchNoResults: 'favorites-search-no-results',
  favoritesBrowseApps: 'favorites-browse-apps',
  favoritesAddButton: 'favorites-add-button',
  addToFavoritesDialog: 'add-to-favorites-dialog',
  addToFavoritesSearchInput: 'add-to-favorites-search-input',
  addToFavoritesToggle: 'add-to-favorites-toggle',
  addToFavoritesLoading: 'add-to-favorites-loading',
  addToFavoritesError: 'add-to-favorites-error',
  addToFavoritesRetry: 'add-to-favorites-retry',
  addToFavoritesNothingToAdd: 'add-to-favorites-nothing-to-add',
  addToFavoritesNoResults: 'add-to-favorites-no-results',

  // Add Widget modal
  addWidgetSearchInput: 'add-widget-search-input',
  addWidgetSidebarItem: 'add-widget-sidebar-item',
  addWidgetNoResults: 'add-widget-no-results',

  // Chat Widget (on dashboard)
  chatWidget: 'chat-widget',
  chatWidgetFullscreenButton: 'chat-widget-fullscreen-button',
  productWidgetReloadButton: 'product-widget-reload-button',
  productWidgetNotFound: 'product-widget-not-found',

  // Chat (fullscreen)
  chatRoomList: 'chat-room-list',
  chatMessageInput: 'chat-message-input',
  chatSendButton: 'chat-send-button',
  chatAddToDashboardButton: 'chat-add-to-dashboard-button',
  chatMediaPlaceholder: 'chat-media-placeholder',
  chatMediaPlaceholderBlurhash: 'chat-media-placeholder-blurhash',

  // Chat — P2P contact search (PB-217)
  chatRoomItem: 'chat-room-item',
  chatNewRequestsItem: 'chat-new-requests-item',
  chatRequestItem: 'chat-request-item',
  chatRequestAcceptButton: 'chat-request-accept-button',
  chatRequestDeclineButton: 'chat-request-decline-button',
  chatNewRequestsCount: 'chat-new-requests-count',
  chatDeclineDialog: 'chat-decline-dialog',
  chatDeclineDialogConfirm: 'chat-decline-dialog-confirm',
  chatOutgoingRequestItem: 'chat-outgoing-request-item',
  chatOutgoingPendingRoom: 'chat-outgoing-pending-room',
  chatOutgoingPendingRoomMenuTrigger: 'chat-outgoing-pending-room-menu-trigger',
  chatOutgoingPendingRoomRemove: 'chat-outgoing-pending-room-remove',
  chatQuickReactionsRow: 'chat-quick-reactions-row',
  chatReactionPill: 'chat-reaction-pill',

  // Chat — message display + actions (seeded-session coverage)
  chatMessageBubble: 'chat-message-bubble',
  chatMessageLink: 'chat-message-link',
  chatDateSeparator: 'chat-date-separator',
  chatNoMessagesPlaceholder: 'chat-no-messages-placeholder',
  chatMessageContextMenu: 'chat-message-context-menu',
  chatMessageContextMenuReply: 'chat-message-context-menu-reply',
  chatMessageContextMenuEdit: 'chat-message-context-menu-edit',
  chatMessageContextMenuCopy: 'chat-message-context-menu-copy',
  chatMessageContextMenuEditHistory: 'chat-message-context-menu-edit-history',
  chatMessageContextMenuForward: 'chat-message-context-menu-forward',
  chatMessageContextMenuSelect: 'chat-message-context-menu-select',
  chatMessageContextMenuDelete: 'chat-message-context-menu-delete',
  chatEmojiPickerOpenButton: 'chat-emoji-picker-open-button',
  chatEmojiPicker: 'chat-emoji-picker',
  chatReplyComposer: 'chat-reply-composer',
  chatEditComposer: 'chat-edit-composer',
  chatScrollToBottomButton: 'chat-scroll-to-bottom-button',
  chatUnreadReactionsButton: 'chat-unread-reactions-button',
  chatRoomHeaderMenuTrigger: 'chat-room-header-menu-trigger',
  chatRoomHeaderMenuDelete: 'chat-room-header-menu-delete',
  contactSearchInput: 'contact-search-input',
  contactResultItem: 'contact-result-item',
  chatSearchEntryButton: 'chat-search-entry-button',
  contactSearchMessageItem: 'contact-search-message-item',
  contactSearchRecentItem: 'contact-search-recent-item',
  contactSearchClearRecent: 'contact-search-clear-recent',
  contactSearchNoResults: 'contact-search-no-results',

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
  offlineAccessDialogCancel: 'offline-access-dialog-cancel',
  offlineAccessUpdateButton: 'offline-access-update-button',

  // Browser tabs
  tabHoverVersionPin: 'tab-hover-version-pin',
  browserTabStrip: 'browser-tab-strip',
  tabHoverCard: 'tab-hover-card',
  tabHoverRam: 'tab-hover-ram',

  // New tab page
  newTabPage: 'new-tab-page',
  newTabWordmark: 'new-tab-wordmark',
  newTabPinnedCard: 'new-tab-pinned-card',
  newTabRecentCard: 'new-tab-recent-card',
  newTabClearRecents: 'new-tab-clear-recents',
  newTabRecentToast: 'new-tab-recent-toast',
  newTabRecentUndo: 'new-tab-recent-undo',

  // Permission settings
  permissionRow: 'permission-row',
  permissionResetButton: 'permission-reset-button',

  // Custom Chains settings
  customChainsEndpointInput: 'custom-chains-endpoint-input',
  customChainsNameInput: 'custom-chains-name-input',
  customChainsAddButton: 'custom-chains-add-button',
  customChainsEntry: 'custom-chains-entry',
  customChainsRemoveButton: 'custom-chains-remove-button',

  // Call buttons
  callAudioButton: 'call-audio-button',
  callVideoButton: 'call-video-button',

  // Network connection settings
  networkConnectionPreference: 'network-connection-preference',
  networkConnectionChainRow: 'network-connection-chain-row',
  networkConnectionChainTabs: 'network-connection-chain-tabs',
  productLoadNotice: 'product-load-notice',
  productLoadReloadButton: 'product-load-reload-button',
  productLoadSwitchButton: 'product-load-switch-button',
} as const;
