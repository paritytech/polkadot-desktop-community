// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type NetworkHealth } from '@/domains/network';
import { networkMonitor } from '@/aggregates/network-monitor';

import { NetworkButton } from './NetworkButton';

function renderButton() {
  return render(
    <TranslationProvider>
      <NetworkButton />
    </TranslationProvider>,
  );
}

async function openPanel() {
  const user = userEvent.setup();
  renderButton();
  await user.click(await screen.findByRole('button', { name: 'Network' }));

  return screen.findByTestId(TEST_IDS.networkPanel);
}

describe('NetworkButton', () => {
  it.each<[NetworkHealth, string]>([
    ['connected', 'ok'],
    ['syncing', 'idle'],
    ['unstable', 'warn'],
    ['unreachable', 'err'],
  ])('badges the button for a %s network with the %s tone', async (health, tone) => {
    networkMonitor.health.set(health);
    renderButton();

    const button = await screen.findByRole('button', { name: 'Network' });
    expect(button.getAttribute('data-testid')).toBe(TEST_IDS.networkStatusButton);
    expect(button.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe(tone);
  });

  it('shows the network panel only once pressed', async () => {
    const user = userEvent.setup();
    renderButton();

    const button = await screen.findByRole('button', { name: 'Network' });
    expect(screen.queryByTestId(TEST_IDS.networkPanel)).toBeNull();

    await user.click(button);

    expect(await screen.findByTestId(TEST_IDS.networkPanel)).toBeTruthy();
  });

  it('closes the popover when the window loses focus', async () => {
    await openPanel();

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.networkPanel)).toBeNull());
  });
});
