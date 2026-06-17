import { blake2b } from '@noble/hashes/blake2.js';
import { type CodecType, type ProductAccountId } from '@novasamatech/host-api';
import { HDKD } from '@scure/sr25519';
import { str, u64 } from 'scale-ts';

import { EXECUTABLE_KINDS } from '../product/manifest/constants';

const JUNCTION_ID_LEN = 32;
const NON_NEGATIVE_INTEGER = /^\d+$/;
// Leading executable-subname label (`app.`, `widget.`, `worker.`) — see `stripExecutableSubname`.
const EXECUTABLE_SUBNAME_PREFIX = new RegExp(`^(?:${EXECUTABLE_KINDS.join('|')})\\.`, 'i');

function createChainCode(code: string): Uint8Array {
  const encoded = NON_NEGATIVE_INTEGER.test(code) ? u64.enc(BigInt(code)) : str.enc(code);

  if (encoded.length > JUNCTION_ID_LEN) {
    return blake2b(encoded, { dkLen: JUNCTION_ID_LEN });
  }

  const chainCode = new Uint8Array(JUNCTION_ID_LEN);
  chainCode.set(encoded);

  return chainCode;
}

function deriveProductPublicKey(rootPublicKey: Uint8Array, productId: string, derivationIndex: number): Uint8Array {
  const junctions = ['product', productId, String(derivationIndex)];

  return junctions.reduce<Uint8Array>((publicKey, junction) => {
    return HDKD.publicSoft(publicKey, createChainCode(junction));
  }, rootPublicKey);
}

// A product reports its account under its executable subname (`app.<base>`,
// `widget.<base>`, `worker.<base>`), but accounts are derived off the bare
// product base name so every executable of one product shares a single account.
// Strip the executable label — but only when a valid base name (`<label>.dot`,
// i.e. 2+ labels) remains, so a product literally named `app.dot` is left as-is.
// Localhost / non-`.dot` identifiers carry no subname and pass through unchanged.
function stripExecutableSubname(productId: string): string {
  const withoutSubname = productId.replace(EXECUTABLE_SUBNAME_PREFIX, '');
  const isValidBaseName = withoutSubname.split('.').length >= 2;

  return isValidBaseName ? withoutSubname : productId;
}

function normalizeProductAccountId([productId, index]: CodecType<typeof ProductAccountId>): CodecType<typeof ProductAccountId> {
  return [stripExecutableSubname(productId), index];
}

export const productAccountService = {
  deriveProductPublicKey,
  normalizeProductAccountId,
};
