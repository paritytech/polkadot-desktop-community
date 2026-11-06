import { type HostSignPayloadData, type ProductAccountId, asProductId } from '@parity/truapi';
import { type UserConfirmationReview } from '@parity/truapi-host';
import { describe, expect, it } from 'vitest';

import { productRuntimeService } from './service';

// `toModalProps` switches over a closed union with no `default` arm, so a variant
// added upstream fails to compile rather than falling through. Exhaustiveness is
// therefore the compiler's job; these cases cover what actually branches at
// runtime — the legacy/product split and the permission grouping.

const DEMO = asProductId('demo.dot');
const A = asProductId('a.dot');
const B = asProductId('b.dot');

const account: ProductAccountId = {
  dotNsIdentifier: DEMO,
  derivationIndex: { tag: 'Index', value: 0 },
};

const payload: HostSignPayloadData = {
  blockHash: '0x00',
  blockNumber: '0x01',
  era: '0x00',
  genesisHash: '0x00',
  method: '0x00',
  nonce: '0x00',
  specVersion: '0x01',
  tip: '0x00',
  transactionVersion: '0x01',
  signedExtensions: [],
  version: 4,
};

const review = (value: UserConfirmationReview) => productRuntimeService.toModalProps(value);

describe('productRuntimeService.toModalProps', () => {
  it('flags a product sign-payload review as non-legacy', () => {
    expect(review({ tag: 'SignPayload', value: { tag: 'Product', value: { request: { account, payload } } } })).toMatchObject({
      target: 'signPayload',
      legacyAccount: false,
    });
  });

  it('flags a legacy-account sign-payload review as legacy', () => {
    expect(review({ tag: 'SignPayload', value: { tag: 'LegacyAccount', value: { signer: '0xabc', payload } } })).toMatchObject({
      target: 'signPayload',
      legacyAccount: true,
    });
  });

  it('flags both sign-raw variants', () => {
    const rawPayload = { tag: 'Bytes', value: { bytes: '0x01' } } as const;

    expect(
      review({
        tag: 'SignRaw',
        value: { tag: 'Product', value: { request: { account, payload: rawPayload }, watermarked: true } },
      }),
    ).toMatchObject({ target: 'signRaw', legacyAccount: false });

    expect(
      review({
        tag: 'SignRaw',
        value: { tag: 'LegacyAccount', value: { request: { signer: '0xabc', payload: rawPayload }, watermarked: true } },
      }),
    ).toMatchObject({ target: 'signRaw', legacyAccount: true });
  });

  it('routes a resource allocation review to the allowance modal', () => {
    expect(review({ tag: 'ResourceAllocation', value: { callingProductId: DEMO, resources: [] } })).toMatchObject({
      target: 'allowance',
    });
  });

  it('routes a statement-store sign review to its own prompt', () => {
    expect(review({ tag: 'StatementStoreProductSign', value: { account, payload: new Uint8Array([1]) } })).toMatchObject({
      target: 'statementSign',
    });
  });

  // The five permission-shaped reviews share a layout but not a payload, so each gets
  // its own target: that is what lets a modal be typed to the review it renders.
  it('routes identity disclosure to the username modal', () => {
    expect(review({ tag: 'IdentityDisclosure', value: { productId: DEMO } })).toMatchObject({
      target: 'identityDisclosure',
    });
  });

  it('routes account access to its own modal', () => {
    expect(review({ tag: 'AccountAccess', value: { requestingProductId: A, targetProductId: B } })).toMatchObject({
      target: 'accountAccess',
    });
  });

  it('routes an account alias to the alias modal', () => {
    const value = {
      callingProductId: A,
      context: { productId: B, suffix: { tag: 'Index' as const, value: 0 } },
      ringLocation: { chainId: '0xaa' as const, junctions: [] },
    };

    expect(review({ tag: 'AccountAlias', value })).toMatchObject({ target: 'accountAlias' });
  });

  it('carries the review payload through untouched', () => {
    const value = { callingProductId: DEMO, resources: [] };

    expect(review({ tag: 'ResourceAllocation', value })).toMatchObject({ review: value });
  });

  // No modal exists for a drain, so the caller answers it as a rejection.
  it('opens no surface for an NFT purse drain', () => {
    const value = {
      callingProductId: A,
      fromPurse: 1,
      owner: { tag: 'Product' as const, value: B },
      itemCount: 2,
      destination: { tag: 'Cheque' as const },
    };

    expect(review({ tag: 'NftPurseDrain', value })).toBeNull();
  });
});

describe('productRuntimeService.toChatMessageContent', () => {
  it('maps text', () => {
    expect(productRuntimeService.toChatMessageContent({ tag: 'Text', value: { text: 'hi' } })).toEqual({
      type: 'text',
      text: 'hi',
    });
  });

  it('maps rich text to its text', () => {
    expect(productRuntimeService.toChatMessageContent({ tag: 'RichText', value: { text: 'hi', media: [] } })).toEqual({
      type: 'richText',
      text: 'hi',
    });
  });

  it('maps a reaction and its removal', () => {
    const value = { messageId: 'm1', emoji: '👍' };

    expect(productRuntimeService.toChatMessageContent({ tag: 'Reaction', value })).toEqual({
      type: 'reacted',
      messageId: 'm1',
      emoji: '👍',
    });
    expect(productRuntimeService.toChatMessageContent({ tag: 'ReactionRemoved', value })).toEqual({
      type: 'reactionRemoved',
      messageId: 'm1',
      emoji: '👍',
    });
  });

  it('decodes a custom payload from hex to bytes', () => {
    const result = productRuntimeService.toChatMessageContent({
      tag: 'Custom',
      value: { messageType: 'vote', payload: '0x0102' },
    });

    expect(result).toEqual({ type: 'custom', messageType: 'vote', payload: new Uint8Array([1, 2]) });
  });

  it('carries alt onto a custom message', () => {
    const result = productRuntimeService.toChatMessageContent(
      { tag: 'Custom', value: { messageType: 'vote', payload: '0x0102' } },
      'Coin flip result',
    );

    expect(result).toMatchObject({ type: 'custom', alt: 'Coin flip result' });
  });

  it('drops alt for every other kind', () => {
    expect(productRuntimeService.toChatMessageContent({ tag: 'Text', value: { text: 'hi' } }, 'x')).toEqual({
      type: 'text',
      text: 'hi',
    });
  });

  it('leaves alt absent on a custom message sent without one', () => {
    const result = productRuntimeService.toChatMessageContent({
      tag: 'Custom',
      value: { messageType: 'vote', payload: '0x0102' },
    });

    expect('alt' in result).toBe(false);
  });

  it('falls back for an actions payload', () => {
    expect(productRuntimeService.toChatMessageContent({ tag: 'Actions', value: { actions: [], layout: 'Column' } })).toEqual({
      type: 'text',
      text: 'Unsupported message format',
    });
  });

  it('falls back for a variant it cannot represent', () => {
    const file = { url: '', fileName: 'f', mimeType: 'text/plain', sizeBytes: 0n };

    expect(productRuntimeService.toChatMessageContent({ tag: 'File', value: file })).toEqual({
      type: 'text',
      text: 'Unsupported message format',
    });
  });
});

describe('productRuntimeService.humanizeCallSegment', () => {
  it('reads the same whether the runtime declares snake or camel case', () => {
    expect(productRuntimeService.humanizeCallSegment('bond_extra')).toBe('Bond Extra');
    expect(productRuntimeService.humanizeCallSegment('bondExtra')).toBe('Bond Extra');
    expect(productRuntimeService.humanizeCallSegment('Balances')).toBe('Balances');
  });
});

describe('productRuntimeService.stringifyCallArguments', () => {
  // JSON.stringify throws on a bigint. A balance vanishing from a transaction the
  // user is about to approve is the worst thing this function could do.
  it('keeps a bigint balance instead of throwing', () => {
    const json = productRuntimeService.stringifyCallArguments({ dest: 'alice', value: 12345678901234567890n });

    expect(json).toContain('12345678901234567890');
  });

  it('falls back to an empty object rather than undefined', () => {
    expect(productRuntimeService.stringifyCallArguments(undefined)).toBe('{}');
  });
});

describe('productRuntimeService.describeResources', () => {
  it('names each requested resource', () => {
    const described = productRuntimeService.describeResources([
      { tag: 'StatementStoreAllowance' },
      { tag: 'BulletinAllowance' },
      { tag: 'SmartContractAllowance', value: { tag: 'Index', value: 3 } },
    ]);

    expect(described).toEqual([
      { key: 'feature.productRuntime.review.resource.statementStore' },
      { key: 'feature.productRuntime.review.resource.bulletin' },
      { key: 'feature.productRuntime.review.resource.smartContract', values: { account: '#3' } },
    ]);
  });

  // The one grant that is not storage: it removes the prompt the user is currently
  // answering, so it gets its own key rather than sharing the storage-slot copy.
  it('keys auto-signing separately from the storage grants', () => {
    expect(productRuntimeService.describeResources([{ tag: 'AutoSigning' }])).toEqual([
      { key: 'feature.productRuntime.review.resource.autoSigning' },
    ]);
  });
});
