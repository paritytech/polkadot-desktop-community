import { type BrowserWindow, type MenuItem, type MenuItemConstructorOptions, Menu, app, dialog, ipcMain, shell } from 'electron';

import { PLATFORM } from '../shared/constants/platform';

import { exportLogs } from './logs';

// Stable ids so the renderer can toggle item state through IPC. The Find items
// start disabled — they're only meaningful while a product webview is on screen,
// and the renderer enables them via `menu:set-find-enabled` when that's true.
const FIND_MENU_IDS = ['edit:find', 'edit:find-next', 'edit:find-previous'] as const;

// All zoom items (visible + hidden accelerator twins). Start disabled; the renderer
// enables them via `menu:set-zoom-enabled` only while a product webview is on screen.
const ZOOM_MENU_IDS = [
  'view:zoom-in',
  'view:zoom-in-eq',
  'view:zoom-in-num',
  'view:zoom-out',
  'view:zoom-out-num',
  'view:zoom-reset',
  'view:zoom-reset-num',
] as const;

const PRODUCT_DASHBOARD_MENU_IDS = ['tab:add-to-dashboard'] as const;

// Builds a once-only registrar for an IPC channel that bulk-toggles `enabled` on a
// group of menu items. `buildMenuTemplate` runs on every window creation but the IPC
// handler is global, so the returned function self-guards to stay idempotent.
function makeMenuEnabledIpcRegistrar(channel: string, ids: readonly string[]) {
  let registered = false;
  return () => {
    if (registered) return;
    registered = true;
    ipcMain.on(channel, (_event, enabled: boolean) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) return;
      for (const id of ids) {
        const item = menu.getMenuItemById(id);
        if (item) item.enabled = !!enabled;
      }
    });
  };
}

const registerFindEnabledIpc = makeMenuEnabledIpcRegistrar('menu:set-find-enabled', FIND_MENU_IDS);
const registerZoomEnabledIpc = makeMenuEnabledIpcRegistrar('menu:set-zoom-enabled', ZOOM_MENU_IDS);
const registerProductDashboardEnabledIpc = makeMenuEnabledIpcRegistrar(
  'menu:set-product-dashboard-enabled',
  PRODUCT_DASHBOARD_MENU_IDS,
);

export function buildMenuTemplate(window: BrowserWindow | null): Menu {
  registerFindEnabledIpc();
  registerZoomEnabledIpc();
  registerProductDashboardEnabledIpc();

  const send = (channel: string, ...args: unknown[]) => {
    window?.webContents.send(channel, ...args);
  };

  const template: MenuItemConstructorOptions[] | MenuItem[] = [
    {
      label: 'Edit',
      accelerator: 'e',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'pasteAndMatchStyle', label: 'Paste and Match Style' },
        { role: 'delete', label: 'Delete' },
        { role: 'selectAll', label: 'Select All' },
        { type: 'separator' },
        { id: 'edit:find', label: 'Find', accelerator: 'CmdOrCtrl+F', enabled: false, click: () => send('edit:find') },
        {
          id: 'edit:find-next',
          label: 'Find Next',
          accelerator: 'CmdOrCtrl+G',
          enabled: false,
          click: () => send('edit:find-next'),
        },
        {
          id: 'edit:find-previous',
          label: 'Find Previous',
          accelerator: 'Shift+CmdOrCtrl+G',
          enabled: false,
          click: () => send('edit:find-previous'),
        },
      ],
    },
    {
      label: 'View',
      accelerator: 'V',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => send('webview:reload') },
        { type: 'separator' },
        // Custom zoom: these zoom the product webview *guest content* (per product,
        // persisted), not the renderer chrome. Hidden twins cover numpad and the
        // unshifted `Cmd+=`. All start disabled (enabled by `menu:set-zoom-enabled`).
        // The hidden twins still need a `label` — Electron's buildFromTemplate rejects
        // an item with none of label/role/type, even when `visible: false`.
        {
          id: 'view:zoom-reset-num',
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+Num0',
          visible: false,
          enabled: false,
          click: () => send('view:zoom-reset'),
        },
        {
          id: 'view:zoom-in-num',
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+NumAdd',
          visible: false,
          enabled: false,
          click: () => send('view:zoom-in'),
        },
        {
          id: 'view:zoom-out-num',
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+NumSub',
          visible: false,
          enabled: false,
          click: () => send('view:zoom-out'),
        },
        {
          id: 'view:zoom-in-eq',
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          visible: false,
          enabled: false,
          click: () => send('view:zoom-in'),
        },
        {
          id: 'view:zoom-reset',
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          enabled: false,
          click: () => send('view:zoom-reset'),
        },
        {
          id: 'view:zoom-in',
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          enabled: false,
          click: () => send('view:zoom-in'),
        },
        {
          id: 'view:zoom-out',
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          enabled: false,
          click: () => send('view:zoom-out'),
        },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    },
    {
      label: 'Tab',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => send('tab:new') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('tab:close') },
        { label: 'Focus Address Bar', accelerator: 'CmdOrCtrl+L', click: () => send('address-bar:focus') },
        {
          id: 'tab:add-to-dashboard',
          label: 'Add to Dashboard',
          accelerator: 'CmdOrCtrl+D',
          enabled: false,
          click: () => send('product:add-to-dashboard'),
        },
        { type: 'separator' },
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => send('navigate:history-back') },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => send('navigate:history-forward') },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Control+Tab', click: () => send('tab:next') },
        { label: 'Previous Tab', accelerator: 'Control+Shift+Tab', click: () => send('tab:prev') },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          visible: false,
          click: () => send('tab:goto', i),
        })),
      ],
    },
    {
      label: 'Window',
      accelerator: 'w',
      role: 'window' as const,
      submenu: [{ role: 'minimize' as const, label: 'Minimize' }],
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Reload Electron Shell',
          accelerator: 'CmdOrCtrl+Shift+R',
          click() {
            window?.webContents.reload();
          },
        },
        {
          label: 'Open Devtools',
          click() {
            window?.webContents.openDevTools({ mode: 'right' });
          },
        },
        {
          label: 'Reset App Data...',
          async click() {
            if (window) {
              const { response } = await dialog.showMessageBox(window, {
                type: 'warning',
                title: 'Reset App Data',
                message: 'This will delete all app data and return to the onboarding screen.',
                detail: 'This action cannot be undone.',
                buttons: ['Cancel', 'Reset Data'],
                defaultId: 0,
                cancelId: 0,
              });

              if (response === 1) {
                window?.webContents.send('reset-app-data');
              }
            }
          },
        },
        {
          label: 'Download Logs...',
          async click() {
            await exportLogs();
          },
        },
      ],
    },
    {
      label: 'Help',
      accelerator: 'h',
      role: 'help',
      submenu: [
        {
          label: 'Check for updates',
          click() {
            window?.webContents.send('app:check-for-updates-request');
          },
        },
        {
          label: 'Polkadot Desktop Help',
          click() {
            shell.openExternal('https://docs.polkadot.io/');
          },
        },
      ],
    },
  ];

  // macOS has specific menu conventions
  if (PLATFORM.IS_MAC) {
    template.unshift({
      // first macOS menu is the name of the app
      role: 'appMenu',
      label: app.name,
      submenu: [
        { role: 'about', label: 'About Polkadot Desktop' },
        {
          label: 'Check for Updates...',
          click() {
            window?.webContents.send('app:check-for-updates-request');
          },
        },
        { type: 'separator' },
        { role: 'hide', label: 'Hide' },
        { role: 'hideOthers', label: 'Hide Others' },
        { role: 'unhide', label: 'Unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit' },
      ],
    });

    // Window menu (index shifted by 1 due to appMenu unshift)
    const windowMenu = template[4];
    if (windowMenu) {
      windowMenu.submenu = [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
      ];
    }
  } else {
    template.unshift({
      label: 'File',
      accelerator: 'f',
      submenu: [{ role: 'quit', label: 'Quit' }],
    });
  }

  return Menu.buildFromTemplate(template);
}
