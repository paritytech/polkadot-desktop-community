// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { dotNsTldResource } from '@/domains/product';
import { openDotNsUrlSideEffect } from '@/features/browser';

import { MessageText } from './MessageText';

// The navigation is a DI side effect: a handler registered on it observes the real
// fan-out, so nothing has to stand in for the feature that declares it.
const openDotNsUrl = vi.fn();
openDotNsUrlSideEffect.registerHandler({ available: () => true, body: openDotNsUrl });

afterEach(() => {
  openDotNsUrl.mockClear();
  cleanup();
});

describe('MessageText', () => {
  it('opens a product link in Desktop', async () => {
    render(<MessageText text="open coff3r.dot now" />);

    const link = await screen.findByTestId(TEST_IDS.chatMessageLink);
    expect(link).toHaveAttribute('role', 'link');
    expect(link).toHaveTextContent('coff3r.dot');

    fireEvent.click(link);

    expect(openDotNsUrl).toHaveBeenCalledWith({ identifier: 'coff3r.dot', pathname: '' });
  });

  it('opens a product link on Enter', async () => {
    render(<MessageText text="coff3r.dot" />);

    fireEvent.keyDown(await screen.findByTestId(TEST_IDS.chatMessageLink), { key: 'Enter' });

    expect(openDotNsUrl).toHaveBeenCalledWith({ identifier: 'coff3r.dot', pathname: '' });
  });

  it('opens an https link outside the app', async () => {
    render(<MessageText text="see https://example.com" />);

    const link = await screen.findByTestId(TEST_IDS.chatMessageLink);
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders text without links as plain text', async () => {
    const { container } = render(<MessageText text="hello there" />);

    await screen.findByText('hello there');
    expect(screen.queryByTestId(TEST_IDS.chatMessageLink)).toBeNull();
    expect(container).toHaveTextContent('hello there');
  });

  it('renders no links while the TLD is unsettled', async () => {
    const neverSettles = vi.fn(() => new Promise<string>(() => {}));
    dotNsTldResource.instead(neverSettles);
    const { container } = render(<MessageText text="open coff3r.dot now" />);

    // The first render is plain text regardless — wait until the read is actually
    // in flight, so the assertion is about the pending state, not the mount.
    await waitFor(() => expect(neverSettles).toHaveBeenCalled());
    expect(screen.queryByTestId(TEST_IDS.chatMessageLink)).toBeNull();
    expect(container).toHaveTextContent('open coff3r.dot now');
  });
});
