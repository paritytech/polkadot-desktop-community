// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';

const { usePinProductMock, useDisplayedProductMock } = vi.hoisted(() => ({
  usePinProductMock: vi.fn(),
  useDisplayedProductMock: vi.fn(),
}));

vi.mock('@/domains/product', () => ({
  usePinProduct: () => usePinProductMock(),
  useDisplayedProduct: () => useDisplayedProductMock(),
  useProductHeaderProps: ({ product }: { product: { displayName?: string } | null }) => ({
    name: product?.displayName ?? '',
    description: undefined,
    iconSrc: undefined,
  }),
  useProductIcon: () => ({ data: null, pending: false, error: null }),
}));

vi.mock('@/shared/translation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('@novasamatech/tr-ui', () => ({
  ProductHeader: ({ name }: { name: string }) => <div>{name}</div>,
  Button: ({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void; [k: string]: unknown }) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Dialog: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  }),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

import { EnableOfflineDialog } from './EnableOfflineDialog';

describe('EnableOfflineDialog', () => {
  it('calls usePinProduct.run(productId) on confirm', () => {
    const runMock = vi.fn().mockReturnValue({ subscribe: vi.fn() });
    usePinProductMock.mockReturnValue({ run: runMock, pending: false });
    useDisplayedProductMock.mockReturnValue({
      data: {
        baseName: 'a.dot',
        displayName: 'A',
        description: '',
        icon: { cid: '', format: 'png' },
        executables: {},
      },
      pending: false,
      error: null,
    });

    render(<EnableOfflineDialog productId="a.dot" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId(TEST_IDS.offlineAccessEnableConfirm));

    expect(runMock).toHaveBeenCalledWith('a.dot');
  });
});
