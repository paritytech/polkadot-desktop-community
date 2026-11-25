// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';
import { environmentUseCase } from '@/domains/application';
import { type ChatMessage, type TransferContent } from '@/domains/chat';

import { CoinageTransferMessageBubble } from './CoinageTransferMessageBubble';

// The asset comes from the active environment's catalog; spied in place so each case
// states the symbol and precision it renders against.
const assetMock = vi.spyOn(environmentUseCase, 'getActiveDigitalDollarAsset');

const content: TransferContent = { type: 'transfer', kind: 'coinage', amount: 12_500_000n, coinageStatus: 'sent' };

const message: ChatMessage = {
  messageId: 'transfer-1',
  sessionId: 'session-1',
  peer: { type: 'p2p', accountId: '0xpeer', name: 'Alice' },
  timestamp: 1_700_000_000_000,
  content,
  status: { direction: 'outgoing', state: 'sent' },
};

const renderBubble = (isSeen = false) =>
  render(
    <TranslationProvider>
      <CoinageTransferMessageBubble message={message} content={content} isMe isSeen={isSeen} />
    </TranslationProvider>,
  );

describe('CoinageTransferMessageBubble', () => {
  afterEach(() => vi.clearAllMocks());

  // The asset name ships with the build rather than the translations, so a
  // publisher sets it in VITE_ENVIRONMENTS instead of editing thirteen locales.
  it.each([
    ['CASH', 6, '12.500'],
    ['pUSD', 6, '12.500'],
    ['tUSD', 4, '1,250'],
  ])('renders the configured symbol %s and its precision', (symbol, precision, amount) => {
    assetMock.mockReturnValue({ assetId: 1, symbol, precision, palletName: 'Assets' });

    renderBubble();

    expect(screen.getByText(symbol)).toBeTruthy();
    expect(screen.getByText(amount)).toBeTruthy();
  });

  it('shows a double check on my transfer the peer has seen', () => {
    assetMock.mockReturnValue({ assetId: 1, symbol: 'CASH', precision: 6, palletName: 'Assets' });

    const { container } = renderBubble(true);

    expect(container.querySelector('.lucide-check-check')).not.toBeNull();
  });
});
