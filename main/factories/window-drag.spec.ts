import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() },
  screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
}));

import { type DragWindow, createWindowDragController } from './window-drag';

function makeWindow(overrides: Partial<DragWindow> = {}): DragWindow {
  return {
    getPosition: () => [100, 50],
    setPosition: vi.fn(),
    isMaximized: () => false,
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isDestroyed: () => false,
    ...overrides,
  };
}

const INTERVAL = 16;

describe('windowDragController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves the window so the grabbed point follows the cursor', () => {
    const setPosition = vi.fn();
    const win = makeWindow({ getPosition: () => [100, 50], setPosition });
    const getCursorPoint = vi
      .fn()
      .mockReturnValueOnce({ x: 200, y: 80 }) // at drag start
      .mockReturnValue({ x: 250, y: 100 }); // on tick

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint, intervalMs: INTERVAL });
    controller.startDrag();
    vi.advanceTimersByTime(INTERVAL);

    // offset = window(100,50) - cursor(200,80) = (-100,-30); new = cursor(250,100) + offset
    expect(setPosition).toHaveBeenCalledWith(150, 70);
  });

  it('stops moving the window after the drag ends', () => {
    const setPosition = vi.fn();
    const win = makeWindow({ setPosition });
    const getCursorPoint = vi.fn().mockReturnValue({ x: 200, y: 80 });

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint, intervalMs: INTERVAL });
    controller.startDrag();
    vi.advanceTimersByTime(INTERVAL);
    controller.endDrag();
    setPosition.mockClear();
    vi.advanceTimersByTime(INTERVAL * 5);

    expect(setPosition).not.toHaveBeenCalled();
  });

  it('does not stack intervals when startDrag is called again', () => {
    const setPosition = vi.fn();
    const win = makeWindow({ setPosition });
    const getCursorPoint = vi.fn().mockReturnValue({ x: 200, y: 80 });

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint, intervalMs: INTERVAL });
    controller.startDrag();
    controller.startDrag();
    vi.advanceTimersByTime(INTERVAL);

    expect(setPosition).toHaveBeenCalledTimes(1);
  });

  it('maximizes a non-maximized window on toggle', () => {
    const maximize = vi.fn();
    const unmaximize = vi.fn();
    const win = makeWindow({ isMaximized: () => false, maximize, unmaximize });

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint: () => ({ x: 0, y: 0 }) });
    controller.toggleMaximize();

    expect(maximize).toHaveBeenCalledTimes(1);
    expect(unmaximize).not.toHaveBeenCalled();
  });

  it('unmaximizes a maximized window on toggle', () => {
    const maximize = vi.fn();
    const unmaximize = vi.fn();
    const win = makeWindow({ isMaximized: () => true, maximize, unmaximize });

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint: () => ({ x: 0, y: 0 }) });
    controller.toggleMaximize();

    expect(unmaximize).toHaveBeenCalledTimes(1);
    expect(maximize).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no window', () => {
    const getCursorPoint = vi.fn().mockReturnValue({ x: 200, y: 80 });
    const controller = createWindowDragController({ getWindow: () => null, getCursorPoint, intervalMs: INTERVAL });

    expect(() => {
      controller.startDrag();
      vi.advanceTimersByTime(INTERVAL);
      controller.toggleMaximize();
    }).not.toThrow();
  });

  it('unmaximizes a maximized window before starting to drag', () => {
    const unmaximize = vi.fn();
    const win = makeWindow({ isMaximized: () => true, unmaximize });

    const controller = createWindowDragController({
      getWindow: () => win,
      getCursorPoint: () => ({ x: 200, y: 80 }),
      intervalMs: INTERVAL,
    });
    controller.startDrag();

    expect(unmaximize).toHaveBeenCalledTimes(1);
  });

  it('stops the drag loop after the safety timeout', () => {
    const setPosition = vi.fn();
    const win = makeWindow({ setPosition });
    const getCursorPoint = vi.fn().mockReturnValue({ x: 200, y: 80 });

    const controller = createWindowDragController({
      getWindow: () => win,
      getCursorPoint,
      intervalMs: INTERVAL,
      maxDurationMs: 1000,
    });
    controller.startDrag();
    vi.advanceTimersByTime(1000);
    setPosition.mockClear();
    vi.advanceTimersByTime(INTERVAL * 5);

    expect(setPosition).not.toHaveBeenCalled();
  });

  it('stops dragging if the window becomes destroyed mid-drag', () => {
    const setPosition = vi.fn();
    let destroyed = false;
    const win = makeWindow({ setPosition, isDestroyed: () => destroyed });
    const getCursorPoint = vi.fn().mockReturnValue({ x: 200, y: 80 });

    const controller = createWindowDragController({ getWindow: () => win, getCursorPoint, intervalMs: INTERVAL });
    controller.startDrag();
    destroyed = true;
    setPosition.mockClear();
    vi.advanceTimersByTime(INTERVAL * 3);

    expect(setPosition).not.toHaveBeenCalled();
  });
});
