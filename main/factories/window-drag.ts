import { type BrowserWindow, ipcMain, screen } from 'electron';

export type DragWindow = {
  getPosition: () => [number, number];
  setPosition: (x: number, y: number) => void;
  isMaximized: () => boolean;
  maximize: () => void;
  unmaximize: () => void;
  isDestroyed: () => boolean;
};

type CursorPoint = { x: number; y: number };

type WindowDragControllerDeps = {
  getWindow: () => DragWindow | null;
  getCursorPoint: () => CursorPoint;
  intervalMs?: number;
  maxDurationMs?: number;
};

const DEFAULT_INTERVAL_MS = 16; // ~60fps
const DEFAULT_MAX_DURATION_MS = 30_000;

/**
 * Drives custom window dragging: while a drag is active it repositions the
 * window each tick so the grabbed point stays under the OS cursor. Pure and
 * dependency-injected so it can be tested without the Electron runtime.
 */
export function createWindowDragController({
  getWindow,
  getCursorPoint,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxDurationMs = DEFAULT_MAX_DURATION_MS,
}: WindowDragControllerDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (safetyTimer !== null) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  }

  function getLiveWindow(): DragWindow | null {
    const win = getWindow();
    return win && !win.isDestroyed() ? win : null;
  }

  function startDrag() {
    stop();

    const win = getLiveWindow();
    if (!win) return;

    // Native behavior: starting a drag on a maximized window restores it under
    // the cursor. We approximate that by unmaximizing first so subsequent
    // setPosition calls actually move a floating frame.
    if (win.isMaximized()) win.unmaximize();

    const [winX, winY] = win.getPosition();
    const start = getCursorPoint();
    const offsetX = winX - start.x;
    const offsetY = winY - start.y;

    timer = setInterval(() => {
      const current = getLiveWindow();
      if (!current) {
        stop();
        return;
      }

      const cursor = getCursorPoint();
      current.setPosition(cursor.x + offsetX, cursor.y + offsetY);
    }, intervalMs);

    // Safety net: if the renderer never sends drag-end (lost focus, crash,
    // unmount mid-drag), the window would stay glued to the cursor forever.
    safetyTimer = setTimeout(stop, maxDurationMs);
  }

  function endDrag() {
    stop();
  }

  function toggleMaximize() {
    const win = getLiveWindow();
    if (!win) return;

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }

  return { startDrag, endDrag, toggleMaximize };
}

function toDragWindow(win: BrowserWindow | null): DragWindow | null {
  if (!win || win.isDestroyed()) return null;

  return {
    getPosition: () => {
      const [x, y] = win.getPosition();
      return [x ?? 0, y ?? 0];
    },
    setPosition: (x, y) => win.setPosition(x, y),
    isMaximized: () => win.isMaximized(),
    maximize: () => win.maximize(),
    unmaximize: () => win.unmaximize(),
    isDestroyed: () => win.isDestroyed(),
  };
}

/**
 * Wires the renderer's window-drag IPC (sent by `WindowDragRegion` on macOS) to
 * the controller. Register once during app init.
 */
export function setupWindowDrag(getWindow: () => BrowserWindow | null): void {
  const controller = createWindowDragController({
    getWindow: () => toDragWindow(getWindow()),
    getCursorPoint: () => screen.getCursorScreenPoint(),
  });

  // Reject IPC from any webContents that isn't the host window's — product
  // webviews must not be able to move or maximize the shell.
  function fromMainWindow(event: Electron.IpcMainEvent): boolean {
    const win = getWindow();
    return win !== null && !win.isDestroyed() && event.sender === win.webContents;
  }

  ipcMain.on('window:drag-start', event => {
    if (fromMainWindow(event)) controller.startDrag();
  });
  ipcMain.on('window:drag-end', event => {
    if (fromMainWindow(event)) controller.endDrag();
  });
  ipcMain.on('window:toggle-maximize', event => {
    if (fromMainWindow(event)) controller.toggleMaximize();
  });
}
