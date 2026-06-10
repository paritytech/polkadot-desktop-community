// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { useIsPinned } from '@/domains/product';

import { PinIndicator } from './PinIndicator';

vi.mock(import('@/domains/product'), { spy: true });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PinIndicator', () => {
  it('renders nothing when product is not pinned', () => {
    vi.mocked(useIsPinned).mockReturnValue(false);
    const { container } = render(<PinIndicator productId="a.dot" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the pin icon when pinned', () => {
    vi.mocked(useIsPinned).mockReturnValue(true);
    render(<PinIndicator productId="a.dot" />);
    expect(screen.getByTestId(TEST_IDS.offlineAccessPinIndicator)).toBeInTheDocument();
  });
});
