// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { ipfsRawResource } from '@/domains/network';
import { type PersistedProduct, productsResource } from '@/domains/product';

import { ProductTabHover } from './ProductTabHover';

const MY_APP = {
  baseName: 'my-app.dot',
  displayName: 'My App',
  description: 'Send and receive',
  icon: { cid: 'bafyicon', format: 'png' },
  executables: {},
  pinned: false,
  createdAt: 1000,
  updatedAt: 1000,
} as unknown as PersistedProduct;

function renderCard() {
  return render(
    <TranslationProvider>
      <ProductTabHover id="my-app.dot" />
    </TranslationProvider>,
  );
}

function iconBox() {
  const box = screen.getByTestId(TEST_IDS.tabHoverCard).firstElementChild;
  if (!box) throw new Error('the card has no icon box');
  return box;
}

describe('ProductTabHover', () => {
  it('shows the name, the base name and the description', async () => {
    productsResource.instead(() => of([MY_APP]));

    renderCard();

    expect(await screen.findByText('My App')).toBeInTheDocument();
    expect(screen.getByText('my-app.dot')).toBeInTheDocument();
    expect(screen.getByText('Send and receive')).toBeInTheDocument();
  });

  it('names the product by its id and hides the base name line when it has no display name', async () => {
    productsResource.instead(() => of([{ ...MY_APP, displayName: '' }]));

    renderCard();

    await screen.findByText('Send and receive');
    expect(screen.getAllByText('my-app.dot')).toHaveLength(1);
  });

  it('renders no description element when the description is empty', async () => {
    productsResource.instead(() => of([{ ...MY_APP, description: '' }]));

    const { container } = renderCard();

    await screen.findByText('My App');
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows the product icon when it resolves', async () => {
    productsResource.instead(() => of([MY_APP]));
    // Three zero bytes base64-encode to "AAAA" through the real `ipfsService.toDataUrl`.
    ipfsRawResource.instead(() => new Uint8Array([0, 0, 0]));

    renderCard();

    await waitFor(() => expect(iconBox().querySelector('img')).not.toBeNull());
    expect(iconBox().querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('shows the fallback mark when the icon does not resolve', async () => {
    productsResource.instead(() => of([MY_APP]));
    ipfsRawResource.instead(() => null);

    renderCard();

    await screen.findByText('My App');
    await waitFor(() => {
      expect(iconBox().querySelector('img')).toBeNull();
      expect(iconBox().querySelector('svg')).not.toBeNull();
    });
  });

  it('reads the RAM usage as unavailable outside Electron', async () => {
    productsResource.instead(() => of([MY_APP]));

    renderCard();

    await screen.findByText('My App');
    expect(screen.getByTestId(TEST_IDS.tabHoverRam)).toHaveTextContent('RAM usage: —');
  });
});
