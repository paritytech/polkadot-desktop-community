// The core's product-storage key layout: `truapi:product-storage:v1:{len}:{productId}:{key}`,
// with `len` the product id's length in UTF-8 bytes, so an id holding colons
// (`localhost:3000`) still ends where the length says.
//
// TODO(truapi): drop this copy of `ProductStorageKey` when `@parity/truapi-host` exports
// the owner prefix or a key decoder. The core owns the layout; this mirrors 0.32.
const KEY_PREFIX = 'truapi:product-storage:v1:';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** The prefix every key `productId` owns starts with — `ProductStorageKey::owner_prefix`. */
function ownerPrefix(productId: string): string {
  return `${KEY_PREFIX}${textEncoder.encode(productId).length}:${productId}:`;
}

/** The product id that owns `key`, or `undefined` when the key is not in the core's layout. */
function ownerOf(key: string): string | undefined {
  if (!key.startsWith(KEY_PREFIX)) return undefined;

  const rest = key.slice(KEY_PREFIX.length);
  const separator = rest.indexOf(':');
  const length = Number(rest.slice(0, separator));
  if (separator <= 0 || !Number.isSafeInteger(length)) return undefined;

  const bytes = textEncoder.encode(rest.slice(separator + 1));
  if (bytes.length <= length || bytes[length] !== ':'.charCodeAt(0)) return undefined;

  return textDecoder.decode(bytes.slice(0, length));
}

export const productStorageKeyService = {
  ownerPrefix,
  ownerOf,
};
