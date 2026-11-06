// @vitest-environment happy-dom

import { asProductId } from '@parity/truapi';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type ReviewModalProps } from '../service';

import { ProductReviewDialog } from './ProductReviewDialog';

// The dialog reads the product catalog and the chain list to name what is asking and
// where it executes; neither is what these tests are about.

const DEMO = asProductId('demo.dot');
const A = asProductId('a.dot');
const B = asProductId('b.dot');

const account = { dotNsIdentifier: DEMO, derivationIndex: { tag: 'Index' as const, value: 3 } };

function show(props: ReviewModalProps) {
  render(
    <TranslationProvider>
      <ProductReviewDialog props={props} onDecide={vi.fn()} />
    </TranslationProvider>,
  );
}

describe('ProductReviewDialog', () => {
  // The point of the restoration: a transaction is not presented like a permission
  // prompt. It carries the call summary and a way into the raw payload.
  it('gives a transaction the review layout with a details pane', async () => {
    show({
      target: 'createTransaction',
      legacyAccount: false,
      review: {
        tag: 'Product',
        value: {
          payload: { signer: account, genesisHash: '0xaa', callData: '0xbb', extensions: [], txExtVersion: 0, contacts: [] },
        },
      },
    });

    // `findBy` flushes the product-account-address read settling inside `act`.
    expect(await screen.findByTestId(TEST_IDS.signReviewAccount)).toBeInTheDocument();
    expect(screen.getByTestId(TEST_IDS.signReviewNetwork)).toBeInTheDocument();
    expect(screen.getByTestId(TEST_IDS.signReviewMoreDetails)).toBeInTheDocument();
    expect(screen.getByTestId(TEST_IDS.signReviewContinueButton)).toBeInTheDocument();
  });

  // A chain the host cannot decode against must say so rather than show an empty summary.
  it('warns when the call could not be decoded', async () => {
    show({
      target: 'createTransaction',
      legacyAccount: false,
      review: {
        tag: 'Product',
        value: {
          payload: { signer: account, genesisHash: '0xaa', callData: '0xbb', extensions: [], txExtVersion: 0, contacts: [] },
        },
      },
    });

    expect(await screen.findByTestId(TEST_IDS.signReviewCustomChainWarning)).toBeInTheDocument();
  });

  it('shows the alias grant with its own dialog and warning', () => {
    show({
      target: 'accountAlias',
      review: {
        callingProductId: A,
        context: { productId: B, suffix: { tag: 'Index', value: 0 } },
        ringLocation: { chainId: '0xaa', junctions: [] },
      },
    });

    expect(screen.getByTestId(TEST_IDS.aliasPermissionDialog)).toBeInTheDocument();
    expect(screen.getByTestId(TEST_IDS.aliasPermissionAllow)).toBeInTheDocument();
  });

  it('shows the VRF transcript item by item', () => {
    show({
      target: 'signVrf',
      review: {
        callingProductId: A,
        request: { account, transcriptLabel: '0x01', items: [{ label: '0x02', value: '0x03' }] },
      },
    });

    expect(screen.getByTestId(TEST_IDS.signVrfDialog)).toBeInTheDocument();
    expect(screen.getByText('0x02')).toBeInTheDocument();
    expect(screen.getByText('0x03')).toBeInTheDocument();
  });

  it('lists every requested grant on the allowance dialog', () => {
    show({
      target: 'allowance',
      review: { callingProductId: DEMO, resources: [{ tag: 'AutoSigning' }, { tag: 'BulletinAllowance' }] },
    });

    expect(screen.getByTestId(TEST_IDS.allocationRequestDialog)).toBeInTheDocument();
    expect(screen.getByText('Sign on your behalf without asking each time')).toBeInTheDocument();
    expect(screen.getByText('Bulletin storage slot')).toBeInTheDocument();
  });

  // The reason the shell owns the single Dialog: the details pane is a content swap, so
  // the summary must be gone and the payload present without a second dialog mounting.
  it('swaps to the details pane and back inside one dialog', async () => {
    show({
      target: 'createTransaction',
      legacyAccount: false,
      review: {
        tag: 'Product',
        value: {
          payload: { signer: account, genesisHash: '0xaa', callData: '0xbb', extensions: [], txExtVersion: 0, contacts: [] },
        },
      },
    });

    // Let the product-account-address read settle before driving the pane swap.
    await screen.findByTestId(TEST_IDS.signReviewMoreDetails);
    await userEvent.click(screen.getByTestId(TEST_IDS.signReviewMoreDetails));

    expect(screen.getByTestId(TEST_IDS.signReviewCallData)).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_IDS.signReviewAccount)).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByTestId(TEST_IDS.signReviewAccount)).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_IDS.signReviewCallData)).not.toBeInTheDocument();
  });

  it('routes identity disclosure to the username dialog', () => {
    show({ target: 'identityDisclosure', review: { productId: DEMO } });

    expect(screen.getByTestId(TEST_IDS.identityDisclosureDialog)).toBeInTheDocument();
    expect(screen.getByText('Share your username with this app?')).toBeInTheDocument();
    expect(screen.queryByText(/rings|keys/i)).not.toBeInTheDocument();
  });
});
