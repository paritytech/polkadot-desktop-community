// @vitest-environment happy-dom

import { render, screen, within } from '@testing-library/react';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type Chain, type KnownChain, type NetworkMonitorModel, genesisHash, networkMonitorService } from '@/domains/network';
import { networkMonitor } from '@/aggregates/network-monitor';

import { NetworkPanel } from './NetworkPanel';

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

// A chain on screen that is in use starts the panel's clock, which must not tick outside `act`.
function fakeTheClock() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
}

function renderPanel() {
  return render(
    <TranslationProvider>
      <NetworkPanel />
    </TranslationProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NetworkPanel', () => {
  it('shows only its head while no chain is monitored', async () => {
    networkMonitor.health.set('unused');
    renderPanel();

    const dot = await screen.findByTestId(TEST_IDS.networkStatusDot);
    expect(screen.getByRole('heading').textContent).toBe('Network');
    expect(dot.getAttribute('aria-label')).toBe('Not in use');
    expect(dot.getAttribute('data-tone')).toBe('idle');
    expect(screen.queryByTestId(TEST_IDS.networkChainList)).toBeNull();
    expect(screen.queryByTestId(TEST_IDS.networkOtherChains)).toBeNull();
  });

  it('labels the status dot with the network health', async () => {
    networkMonitor.health.set('unstable');
    renderPanel();

    const dot = await screen.findByTestId(TEST_IDS.networkStatusDot);
    expect(dot.getAttribute('aria-label')).toBe('Unstable');
    expect(dot.getAttribute('data-tone')).toBe('warn');
  });

  it('lists the known chains in role order and any other chain in use under its own fold', async () => {
    fakeTheClock();
    networkMonitor.model.set(hold(networkMonitorService.createModel(KNOWN), COLLECTIVES));
    renderPanel();

    const known = await screen.findByTestId(TEST_IDS.networkChainList);
    const names = within(known)
      .getAllByTestId(TEST_IDS.networkChainRowName)
      .map(name => name.textContent);
    expect(names).toEqual(['Relay', 'Hub', 'Storage', 'Identity']);
    expect(screen.getByTestId(TEST_IDS.networkOtherChainsSummary).textContent).toBe('Other chains (1)');
    const other = screen.getByTestId(TEST_IDS.networkOtherChainList);
    expect(within(other).getByTestId(TEST_IDS.networkChainRowName).textContent).toBe('Collectives');
  });

  it('marks a held chain that produces blocks from the live model', async () => {
    fakeTheClock();
    const held = hold(networkMonitorService.createModel(KNOWN), RELAY);
    networkMonitor.model.set(networkMonitorService.recordBestBlock(held, RELAY.genesisHash, 100, Date.now()));
    renderPanel();

    const known = await screen.findByTestId(TEST_IDS.networkChainList);
    const [relayMark] = within(known).getAllByTestId(TEST_IDS.networkChainMark);
    expect(relayMark?.getAttribute('data-kind')).toBe('healthy');
  });
});
