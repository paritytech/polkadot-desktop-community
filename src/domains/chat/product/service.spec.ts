import { describe, expect, it } from 'vitest';

import { type RoomFooter } from '../session/types';

import { productChatService } from './service';

const card = (overrides: Partial<Extract<RoomFooter, { type: 'card' }>> = {}): RoomFooter => ({
  type: 'card',
  productId: 'p',
  messageType: 'm',
  payload: new Uint8Array([1, 2, 3]),
  ...overrides,
});

describe('productChatService.isSameFooter', () => {
  it('equates the same tag and the same card fields', () => {
    expect(productChatService.isSameFooter({ type: 'text' }, { type: 'text' })).toBe(true);
    expect(productChatService.isSameFooter({ type: 'none' }, { type: 'none' })).toBe(true);
    expect(productChatService.isSameFooter(card(), card())).toBe(true);
  });

  it('distinguishes text from none', () => {
    expect(productChatService.isSameFooter({ type: 'text' }, { type: 'none' })).toBe(false);
  });

  it('distinguishes a card from a tag', () => {
    expect(productChatService.isSameFooter(card(), { type: 'text' })).toBe(false);
  });

  it('distinguishes cards differing in a payload byte or length', () => {
    expect(productChatService.isSameFooter(card(), card({ payload: new Uint8Array([1, 2, 4]) }))).toBe(false);
    expect(productChatService.isSameFooter(card(), card({ payload: new Uint8Array([1, 2]) }))).toBe(false);
  });

  it('distinguishes cards differing in messageType or productId', () => {
    expect(productChatService.isSameFooter(card(), card({ messageType: 'x' }))).toBe(false);
    expect(productChatService.isSameFooter(card(), card({ productId: 'x' }))).toBe(false);
  });
});
