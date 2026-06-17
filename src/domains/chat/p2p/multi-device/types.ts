export type DeviceTarget = {
  statementAccountId: Uint8Array;
  encryptionPublicKey: Uint8Array;
};

export type SymmetricEncrypt = (key: Uint8Array, plaintext: Uint8Array) => Uint8Array;

// Per-recipient wrap: given the sender's persistent device private key and the
// recipient device's encryption pubkey, return the bytes that go in
// `RequestDeviceInfo.encryptedKey`.
export type KeyWrap = (
  senderDevicePrivateKey: Uint8Array,
  recipientEncryptionPublicKey: Uint8Array,
  oneShotKey: Uint8Array,
) => Uint8Array;

export type EncryptForRecipientsResult = {
  data: Uint8Array;
  oneShotKey: Uint8Array;
};
