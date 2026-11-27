// @vitest-environment happy-dom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { browserTabs } from '@/aggregates/browser-tabs';
import { PRODUCT } from '../tabs/helpers';

import { Tabs } from './Tabs';

function renderStrip() {
  return render(
    <TranslationProvider>
      <Tabs />
    </TranslationProvider>,
  );
}

function hoverTab(id: string, container: HTMLElement) {
  const tab = container.querySelector(`[data-tab-id="${id}"]`);
  if (!tab) throw new Error(`no tab with id ${id}`);
  fireEvent.mouseEnter(tab);
  act(() => {
    vi.advanceTimersByTime(1001);
  });
}

describe('Tabs hover card', () => {
  beforeEach(() => {
    // `shouldAdvanceTime` keeps `findBy…` polling while the hover delay is advanced by hand.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserTabs.addTab({ id: 'my-app.dot', type: PRODUCT, deeplink: '' }, { persistable: true });
    browserTabs.addTab({ id: 'chat', type: 'chat', deeplink: '' }, { persistable: true });
    browserTabs.selectTab('chat');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens no hover card for a non-product tab', () => {
    const { container } = renderStrip();

    hoverTab('chat', container);

    expect(screen.queryByTestId(TEST_IDS.tabHoverCard)).toBeNull();
  });

  it('opens the hover card for a product tab', async () => {
    const { container } = renderStrip();

    hoverTab('my-app.dot', container);

    expect(await screen.findAllByTestId(TEST_IDS.tabHoverCard)).toHaveLength(1);
  });
});
