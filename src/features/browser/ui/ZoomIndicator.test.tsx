// @vitest-environment happy-dom

import { act, render, screen } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { webviewZoom } from '@/aggregates/webview-zoom';

import { ZoomIndicator } from './ZoomIndicator';

const Providers = ({ children }: PropsWithChildren) => <TranslationProvider>{children}</TranslationProvider>;

const TAB = 'app.dot';

beforeEach(() => {
  webviewZoom.levels$.set({});
});

describe('ZoomIndicator', () => {
  it('is hidden at the default zoom with no action taken', () => {
    render(<ZoomIndicator tabId={TAB} />, { wrapper: Providers });
    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).toBeNull();
  });

  it('stays hidden on mount even when the product already has a non-default zoom (remount / reload)', () => {
    // Simulates switching back to (or reloading) a product that was zoomed earlier:
    // the level is re-read from the aggregate, but no action just happened.
    webviewZoom.zoomIn(TAB);
    render(<ZoomIndicator tabId={TAB} />, { wrapper: Providers });
    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).toBeNull();
  });

  it('surfaces when a zoom action changes the level', () => {
    render(<ZoomIndicator tabId={TAB} />, { wrapper: Providers });
    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).toBeNull();

    act(() => webviewZoom.zoomIn(TAB));

    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).not.toBeNull();
    expect(screen.getByTestId(TEST_IDS.zoomPercent).textContent).toContain('120');
  });

  it('does not surface when a zoom action is a no-op at the limit', () => {
    // Drive to the max so the next zoom-in changes nothing.
    act(() => {
      for (let i = 0; i < 20; i++) webviewZoom.zoomIn(TAB);
    });
    render(<ZoomIndicator tabId={TAB} />, { wrapper: Providers });
    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).toBeNull();

    act(() => webviewZoom.zoomIn(TAB)); // already at max → no level change

    expect(screen.queryByTestId(TEST_IDS.zoomIndicator)).toBeNull();
  });
});
