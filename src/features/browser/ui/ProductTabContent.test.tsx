// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ipfsRawResource } from '@/domains/network';
import { type PersistedProduct, productsResource } from '@/domains/product';

import { ProductTabContent } from './ProductTabContent';

const MY_APP = {
  baseName: 'my-app.dot',
  displayName: 'My App',
  description: '',
  icon: { cid: 'bafyicon', format: 'png' },
  executables: {},
  pinned: false,
  createdAt: 1000,
  updatedAt: 1000,
} as unknown as PersistedProduct;

describe('ProductTabContent', () => {
  it('renders the resolved icon and name for a tab whose product is not installed', async () => {
    // Resolvable live, exactly like the AddressBar shows it.
    productsResource.instead(() => of([MY_APP]));
    // Three zero bytes base64-encode to "AAAA" through the real `ipfsService.toDataUrl`.
    ipfsRawResource.instead(() => new Uint8Array([0, 0, 0]));

    const { container } = render(<ProductTabContent id="my-app.dot" isActive={false} setDeeplink={vi.fn()} />);

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(screen.getByText('My App')).toBeInTheDocument();
  });

  it('renders no <img> when the product icon does not resolve', async () => {
    productsResource.instead(() => of([MY_APP]));
    // `ipfsRawResource`'s own mock already answers null — the no-icon case.

    const { container } = render(<ProductTabContent id="my-app.dot" isActive={false} setDeeplink={vi.fn()} />);

    await screen.findByText('My App');

    expect(container.querySelector('img')).toBeNull();
  });
});
