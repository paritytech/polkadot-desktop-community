// @vitest-environment happy-dom

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type Chain, type KnownChain, type NetworkMonitorModel, genesisHash, networkMonitorService } from '@/domains/network';
import { networkMonitor } from '@/aggregates/network-monitor';
import { TICK_MS } from '../constants';

import { NetworkButton } from './NetworkButton';

const RELAY = buildChain('Polkadot', '01');
const ASSET_HUB = buildChain('Polkadot Asset Hub', '02');
const BULLETIN = buildChain('Polkadot Bulletin', '03');
const PEOPLE = buildChain('Polkadot People', '04');
const COLLECTIVES = buildChain('Collectives', '05');

const KNOWN: KnownChain[] = [
  { role: 'relay', chain: RELAY },
  { role: 'assetHub', chain: ASSET_HUB },
  { role: 'bulletin', chain: BULLETIN },
  { role: 'people', chain: PEOPLE },
];

// One node each, so the chain registry finds an endpoint for every known chain.
function buildChain(name: string, byte: string): Chain {
  return {
    chainId: name,
    genesisHash: v.parse(genesisHash, `0x${byte.repeat(32)}`),
    name,
    assets: [],
    nodes: [{ url: `wss://${byte}.example`, name }],
    addressPrefix: 0,
  };
}

function hold(model: NetworkMonitorModel, chain: Chain): NetworkMonitorModel {
  return networkMonitorService.recordChainActivity(model, { chain, consumers: 1, status: 'connected', following: true });
}

// A chain in use starts the trigger's clock (and the panel's), which must not tick outside `act`.
function fakeTheClock() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
}

function seedProducingRelay() {
  const held = hold(hold(networkMonitorService.createModel(KNOWN), COLLECTIVES), RELAY);
  networkMonitor.model.set(networkMonitorService.recordBestBlock(held, RELAY.genesisHash, 100, Date.now()));
}

function renderButton() {
  return render(
    <TranslationProvider>
      <NetworkButton />
    </TranslationProvider>,
  );
}

async function openPanel() {
  const user = userEvent.setup();
  networkMonitor.model.set(networkMonitorService.createModel(KNOWN));
  renderButton();
  await user.click(await screen.findByRole('button', { name: 'Network' }));

  return screen.findByTestId(TEST_IDS.networkPanel);
}

function readMarkKinds(button: HTMLElement) {
  return within(button)
    .getAllByTestId(TEST_IDS.networkChainMark)
    .map(mark => mark.getAttribute('data-kind'));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NetworkButton', () => {
  it('shows no button while no known chain is listed', async () => {
    renderButton();

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.networkStatusButton)).toBeNull());
  });

  it('draws the mark of each known chain in role order', async () => {
    fakeTheClock();
    seedProducingRelay();
    renderButton();

    const button = await screen.findByRole('button', { name: 'Network' });
    expect(button.getAttribute('data-testid')).toBe(TEST_IDS.networkStatusButton);
    expect(readMarkKinds(button)).toEqual(['healthy', 'unused', 'unused', 'unused']);
    for (const svg of button.querySelectorAll('svg')) {
      expect(svg.getAttribute('class')).toContain('size-');
    }
  });

  it('marks a held chain that stops producing as an outage', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    seedProducingRelay();
    renderButton();

    const button = await screen.findByRole('button', { name: 'Network' });
    expect(readMarkKinds(button)[0]).toBe('healthy');

    vi.setSystemTime(Date.now() + 600_000);
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });

    expect(readMarkKinds(button)[0]).toBe('outage');
  });

  it('looks checked while its popover is open', async () => {
    const user = userEvent.setup();
    networkMonitor.model.set(networkMonitorService.createModel(KNOWN));
    renderButton();

    const button = await screen.findByRole('button', { name: 'Network' });
    await user.click(button);

    await screen.findByTestId(TEST_IDS.networkPanel);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows the network panel only once pressed', async () => {
    const user = userEvent.setup();
    networkMonitor.model.set(networkMonitorService.createModel(KNOWN));
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
