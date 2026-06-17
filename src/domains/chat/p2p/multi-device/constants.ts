// AES-256 one-shot key length and AES-GCM nonce length for the multi-device
// chat envelope. Mirrors Android's `MessageEncryption.aes` (32-byte key,
// 12-byte random nonce).
export const ONE_SHOT_KEY_BYTES = 32;
export const GCM_NONCE_BYTES = 12;
