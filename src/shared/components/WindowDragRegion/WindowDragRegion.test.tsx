// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlatformType } from '@/shared/env';

import { WindowDragRegion } from './WindowDragRegion';

vi.mock('@/shared/env', () => ({ getPlatformType: vi.fn() }));

const mockedGetPlatformType = vi.mocked(getPlatformType);

function stubWindowApi() {
  const api = {
    startWindowDrag: vi.fn(),
    endWindowDrag: vi.fn(),
    toggleMaximizeWindow: vi.fn(),
  };
  // @ts-expect-error partial stub of the preload bridge for tests
  window.App = api;

  return api;
}

afterEach(() => {
  // @ts-expect-error clean up the stubbed bridge between tests
  delete window.App;
  vi.clearAllMocks();
});

describe('WindowDragRegion on macOS', () => {
  beforeEach(() => {
    mockedGetPlatformType.mockReturnValue('desktop-mac');
  });

  it('starts a window drag on primary-button mouse down over a bare area', () => {
    const api = stubWindowApi();
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);

    fireEvent.mouseDown(container.firstChild!, { button: 0 });

    expect(api.startWindowDrag).toHaveBeenCalledTimes(1);
  });

  it('does not start a drag when mouse down lands on an interactive child', () => {
    const api = stubWindowApi();
    render(
      <WindowDragRegion>
        <button data-testid="control">click</button>
      </WindowDragRegion>,
    );

    fireEvent.mouseDown(screen.getByTestId('control'), { button: 0 });

    expect(api.startWindowDrag).not.toHaveBeenCalled();
  });

  it('starts a drag even when an ancestor above the region is marked no-drag', () => {
    // The app shell wraps the whole UI (incl. the header) in an
    // `app-region: no-drag` element — that must not disable the region's drag.
    const api = stubWindowApi();
    const { getByTestId } = render(
      <div style={{ appRegion: 'no-drag' }}>
        <WindowDragRegion>
          <div data-testid="bare">bare</div>
        </WindowDragRegion>
      </div>,
    );

    fireEvent.mouseDown(getByTestId('bare'), { button: 0 });

    expect(api.startWindowDrag).toHaveBeenCalledTimes(1);
  });

  it('does not start a drag on a non-semantic child marked app-region: no-drag', () => {
    const api = stubWindowApi();
    render(
      <WindowDragRegion>
        <div data-testid="control" style={{ appRegion: 'no-drag' }}>
          control
        </div>
      </WindowDragRegion>,
    );

    fireEvent.mouseDown(screen.getByTestId('control'), { button: 0 });

    expect(api.startWindowDrag).not.toHaveBeenCalled();
  });

  it('does not start a drag on a non-primary (e.g. right) button', () => {
    const api = stubWindowApi();
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);

    fireEvent.mouseDown(container.firstChild!, { button: 2 });

    expect(api.startWindowDrag).not.toHaveBeenCalled();
  });

  it('ends the drag when the mouse button is released anywhere', () => {
    const api = stubWindowApi();
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);

    fireEvent.mouseDown(container.firstChild!, { button: 0 });
    window.dispatchEvent(new MouseEvent('mouseup'));

    expect(api.endWindowDrag).toHaveBeenCalledTimes(1);
  });

  it('toggles maximize on double click over a bare area', () => {
    const api = stubWindowApi();
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);

    fireEvent.doubleClick(container.firstChild!);

    expect(api.toggleMaximizeWindow).toHaveBeenCalledTimes(1);
  });

  it('does not toggle maximize when double clicking an interactive child', () => {
    const api = stubWindowApi();
    render(
      <WindowDragRegion>
        <button data-testid="control">click</button>
      </WindowDragRegion>,
    );

    fireEvent.doubleClick(screen.getByTestId('control'));

    expect(api.toggleMaximizeWindow).not.toHaveBeenCalled();
  });
});

describe('WindowDragRegion on Windows/Linux', () => {
  beforeEach(() => {
    mockedGetPlatformType.mockReturnValue('desktop-windows');
  });

  it('keeps the native CSS drag region and does not attach JS drag handlers', () => {
    const api = stubWindowApi();
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);
    const region = container.firstChild as HTMLElement;

    fireEvent.mouseDown(region, { button: 0 });

    expect(api.startWindowDrag).not.toHaveBeenCalled();
    expect(region.getAttribute('style')).toMatch(/drag/);
  });
});

describe('WindowDragRegion on web', () => {
  beforeEach(() => {
    mockedGetPlatformType.mockReturnValue('web');
  });

  it('renders children and does nothing on mouse down (no bridge present)', () => {
    const { container } = render(<WindowDragRegion>content</WindowDragRegion>);

    expect(() => fireEvent.mouseDown(container.firstChild!, { button: 0 })).not.toThrow();
    expect(container.textContent).toBe('content');
  });
});

describe('WindowDragRegion rendering', () => {
  beforeEach(() => {
    mockedGetPlatformType.mockReturnValue('desktop-mac');
  });

  it('renders the element passed via the `as` prop with the given className', () => {
    const { container } = render(
      <WindowDragRegion as="header" className="my-header">
        content
      </WindowDragRegion>,
    );
    const region = container.firstChild as HTMLElement;

    expect(region.tagName).toBe('HEADER');
    expect(region.className).toBe('my-header');
  });
});
