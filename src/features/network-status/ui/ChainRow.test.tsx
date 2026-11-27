// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type BlockBar, type ChainHealth, type ChainStatus } from '@/domains/network';

import { ChainRow } from './ChainRow';

const BARS: readonly BlockBar[] = [
  { number: 1000, health: 'onTime', gapMs: 6000 },
  { number: 1001, health: 'late', gapMs: 9000 },
  { number: 1002, health: 'onTime', gapMs: 6100 },
];

const PRODUCING: ChainHealth = { kind: 'producing', behind: false, sinceLast: 0, liveShare: null };

function buildStatus(overrides: Partial<ChainStatus> = {}): ChainStatus {
  return {
    genesisHash: '0xpeople',
    role: 'people',
    name: 'People',
    bars: BARS,
    latest: 1002,
    sinceLast: 0,
    blockTimeMs: 6000,
    reachable: true,
    phase: 'ready',
    syncShare: null,
    peers: null,
    state: 'live',
    alarm: false,
    ...overrides,
  };
}

function wrap(chain: ChainStatus, health: ChainHealth) {
  return (
    <TranslationProvider>
      <ChainRow chain={chain} health={health} />
    </TranslationProvider>
  );
}

function renderRow(chain: ChainStatus, health: ChainHealth = PRODUCING) {
  return render(wrap(chain, health));
}

function openDetail() {
  fireEvent.click(screen.getByTestId(TEST_IDS.networkChainRowHead));
}

describe('ChainRow', () => {
  it('names a known role by its label', () => {
    renderRow(buildStatus());

    expect(screen.getByTestId(TEST_IDS.networkChainRowName).textContent).toBe('Identity');
  });

  it('names a chain outside the known roles by its catalog name', () => {
    renderRow(buildStatus({ role: null, name: 'Collectives' }));

    expect(screen.getByTestId(TEST_IDS.networkChainRowName).textContent).toBe('Collectives');
  });

  it('reads a producing chain with a measured share with its live share and block time', () => {
    renderRow(buildStatus(), { kind: 'producing', behind: false, sinceLast: 0, liveShare: 6000 / 6900 });

    expect(screen.getByTestId(TEST_IDS.networkChainRowStatus).textContent).toBe('Connected · Live 87% · Block ~7s');
  });

  it('tones the status of a chain with no endpoint on an unreachable network as an error', () => {
    renderRow(buildStatus({ reachable: false }), { kind: 'noEndpoint', networkUnreachable: true });

    const status = screen.getByTestId(TEST_IDS.networkChainRowStatus);
    expect(status.textContent).toBe('No endpoint');
    expect(status.getAttribute('data-tone')).toBe('err');
  });

  it('marks the chain by its health', () => {
    const { rerender } = renderRow(buildStatus());

    expect(screen.getByTestId(TEST_IDS.networkChainMark).getAttribute('data-kind')).toBe('healthy');

    rerender(wrap(buildStatus(), { kind: 'stalled', behind: false, sinceLast: 30_000 }));

    expect(screen.getByTestId(TEST_IDS.networkChainMark).getAttribute('data-kind')).toBe('outage');
  });

  it('keeps the detail closed until the head is pressed', () => {
    renderRow(buildStatus());

    const head = screen.getByTestId(TEST_IDS.networkChainRowHead);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId(TEST_IDS.networkChainRowDetail)).toBeNull();

    openDetail();

    expect(head.getAttribute('aria-expanded')).toBe('true');
    const detail = screen.getByTestId(TEST_IDS.networkChainRowDetail);
    expect(head.getAttribute('aria-controls')).toBe(detail.id);
    expect(detail.textContent).toContain('Last 48 blocks');
    expect(screen.getByTestId(TEST_IDS.networkChainRowBlock).textContent).toBe('#1,002');
    expect(screen.getByTestId(TEST_IDS.networkBlockStrip)).toBeTruthy();
  });

  it('shows the peers of a watched chain in the detail line', () => {
    renderRow(buildStatus({ peers: 4 }));
    openDetail();

    const peers = screen.getByTestId(TEST_IDS.networkChainRowPeers);
    expect(peers.textContent).toBe('4 peers');
    expect(peers.getAttribute('data-tone')).toBeNull();
    expect(peers.parentElement?.textContent).toBe('Last 48 blocks · 4 peers');
  });

  it('warns at zero peers', () => {
    renderRow(buildStatus({ peers: 0 }));
    openDetail();

    const peers = screen.getByTestId(TEST_IDS.networkChainRowPeers);
    expect(peers.textContent).toBe('0 peers');
    expect(peers.getAttribute('data-tone')).toBe('warn');
  });

  it('shows no peers caption without a peer sample', () => {
    renderRow(buildStatus({ peers: null }));
    openDetail();

    expect(screen.queryByTestId(TEST_IDS.networkChainRowPeers)).toBeNull();
    expect(screen.getByTestId(TEST_IDS.networkChainRowDetail).textContent).not.toContain('·');
  });

  it('shows no peers caption for a chain nobody uses', () => {
    renderRow(buildStatus({ peers: 4, state: 'unused' }), { kind: 'unused' });
    openDetail();

    expect(screen.queryByTestId(TEST_IDS.networkChainRowPeers)).toBeNull();
  });

  it('draws an unreachable chain as stubs only, none of its old bars', () => {
    renderRow(buildStatus({ reachable: false }), { kind: 'noEndpoint', networkUnreachable: false });
    openDetail();

    expect(screen.getAllByTestId(TEST_IDS.networkBlockStub)).toHaveLength(48);
    expect(screen.queryAllByTestId(TEST_IDS.networkBlockBar)).toHaveLength(0);
    expect(screen.queryByTestId(TEST_IDS.networkBlockPending)).toBeNull();
  });

  it('draws the ghost bar before the first bar of a chain still searching', () => {
    renderRow(buildStatus({ bars: [], latest: null, sinceLast: null }), {
      kind: 'producing',
      behind: false,
      sinceLast: null,
      liveShare: null,
    });
    openDetail();

    expect(screen.getByTestId(TEST_IDS.networkBlockPending).getAttribute('data-pending')).toBe('searching');
    expect(screen.getAllByTestId(TEST_IDS.networkBlockStub)).toHaveLength(47);
    expect(screen.queryByTestId(TEST_IDS.networkChainRowBlock)).toBeNull();
  });

  it('keeps the strip through updates with the same bars and with a landed bar', () => {
    const { rerender } = renderRow(buildStatus());
    openDetail();

    rerender(wrap(buildStatus(), PRODUCING));
    expect(screen.getAllByTestId(TEST_IDS.networkBlockBar)).toHaveLength(3);

    const landed: BlockBar = { number: 1003, health: 'onTime', gapMs: 6000 };
    rerender(wrap(buildStatus({ bars: [...BARS, landed], latest: 1003 }), PRODUCING));

    const bars = screen.getAllByTestId(TEST_IDS.networkBlockBar);
    expect(bars.map(bar => bar.getAttribute('data-block'))).toEqual(['1000', '1001', '1002', '1003']);
    expect(bars.some(bar => bar.hasAttribute('data-new'))).toBe(false);
    expect(screen.getByTestId(TEST_IDS.networkChainRowBlock).textContent).toBe('#1,003');
  });
});
