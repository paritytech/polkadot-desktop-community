import { blake2b } from '@noble/hashes/blake2.js';
import { HDKD } from '@scure/sr25519';
import { str, u64 } from 'scale-ts';

const JUNCTION_ID_LEN = 32;
const NON_NEGATIVE_INTEGER = /^\d+$/;

const createChainCode = (code: string): Uint8Array => {
  const encoded = NON_NEGATIVE_INTEGER.test(code) ? u64.enc(BigInt(code)) : str.enc(code);

  if (encoded.length > JUNCTION_ID_LEN) {
    return blake2b(encoded, { dkLen: JUNCTION_ID_LEN });
  }

  const chainCode = new Uint8Array(JUNCTION_ID_LEN);
  chainCode.set(encoded);

  return chainCode;
};

const deriveProductPublicKey = (rootPublicKey: Uint8Array, productId: string, derivationIndex: number): Uint8Array => {
  const junctions = ['product', productId, String(derivationIndex)];

  return junctions.reduce<Uint8Array>((publicKey, junction) => {
    return HDKD.publicSoft(publicKey, createChainCode(junction));
  }, rootPublicKey);
};

export const productAccountService = {
  deriveProductPublicKey,
};
