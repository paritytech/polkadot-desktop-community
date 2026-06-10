import { AccountId } from '@polkadot-api/substrate-bindings';

const codec = AccountId();

export function encodeAccountIdSs58(ss58: string): Uint8Array {
  return codec.enc(ss58);
}
