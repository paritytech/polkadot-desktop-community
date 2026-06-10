export type SigningResult = {
  id: number;
  signature: `0x${string}`;
  signedTransaction?: `0x${string}` | Uint8Array;
};

export type CreateTransactionResult = {
  signedTransaction: Uint8Array;
};
