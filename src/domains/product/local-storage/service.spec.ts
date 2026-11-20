import { describe, expect, it } from 'vitest';

import { productStorageKeyService } from './service';

const { ownerPrefix, ownerOf } = productStorageKeyService;

describe('productStorageKeyService', () => {
  it('builds the owner prefix with the id length in UTF-8 bytes', () => {
    expect(ownerPrefix('coffer.dot')).toBe('truapi:product-storage:v1:10:coffer.dot:');
    expect(ownerPrefix('ü.dot')).toBe('truapi:product-storage:v1:6:ü.dot:');
  });

  it('reads the owner back from a key built on its prefix', () => {
    expect(ownerOf(`${ownerPrefix('coffer.dot')}coffer/v1/state`)).toBe('coffer.dot');
    expect(ownerOf(`${ownerPrefix('localhost:3000')}a:b`)).toBe('localhost:3000');
    expect(ownerOf(`${ownerPrefix('ü.dot')}k`)).toBe('ü.dot');
  });

  it('does not let one id prefix-match a longer id that starts with it', () => {
    expect(`${ownerPrefix('app.dot.x')}k`.startsWith(ownerPrefix('app.dot'))).toBe(false);
  });

  it('answers undefined for a key outside the layout', () => {
    expect(ownerOf('plain-key')).toBeUndefined();
    expect(ownerOf('truapi:product-storage:v1:x:a:k')).toBeUndefined();
    expect(ownerOf('truapi:product-storage:v1:5:ab:k')).toBeUndefined();
  });
});
