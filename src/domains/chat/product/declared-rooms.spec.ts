import { afterEach, describe, expect, it } from 'vitest';

import { clearDeclaredProductRooms, getDeclaredProductRooms, registerDeclaredProductRoom } from './declared-rooms';

// The registry is a module-level singleton, so reset it between tests.
afterEach(() => {
  clearDeclaredProductRooms('app.dot');
});

describe('registerDeclaredProductRoom', () => {
  it('returns New on first registration and Exists on repeat', () => {
    const params = { productId: 'app.dot', roomId: 'main' };

    expect(registerDeclaredProductRoom(params)).toBe('New');
    expect(registerDeclaredProductRoom(params)).toBe('Exists');
    expect(getDeclaredProductRooms('app.dot')).toEqual([{ productId: 'app.dot', roomId: 'main' }]);
  });
});

describe('clearDeclaredProductRooms', () => {
  it('drops a product’s declared rooms', () => {
    registerDeclaredProductRoom({ productId: 'app.dot', roomId: 'main' });
    clearDeclaredProductRooms('app.dot');

    expect(getDeclaredProductRooms('app.dot')).toEqual([]);
  });
});
