import { AccountId as PAPIAccountId } from 'polkadot-api';
import { fromHex, toHex } from 'polkadot-api/utils';
import * as v from 'valibot';

import { accountId } from './schemas';
import { type AccountId, type Address } from './types';

const ss58AccountId = PAPIAccountId();

function toAddress(value: AccountId): Address {
  const EVM_ADDRESS_LENGTH = 20;
  const buffer = fromHex(value);

  if (buffer.length === EVM_ADDRESS_LENGTH) {
    return {
      type: 'evm',
      value,
    };
  } else {
    return {
      type: 'ss58',
      value: ss58AccountId.dec(buffer),
    };
  }
}

function toAccountId(value: Address): AccountId {
  switch (value.type) {
    case 'ss58':
      return v.parse(accountId, toHex(ss58AccountId.enc(value.value)));
    case 'evm':
      return v.parse(accountId, value.value);
  }
}

export const accountService = {
  toAddress,
  toAccountId,
};
