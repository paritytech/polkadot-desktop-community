/**
 * Pairwise topic derivation for the device-to-device signaling session.
 * Delegates to the SDK's `createSessionId`, which is byte-equivalent to
 * Android's `deriveCommunicationTopic`:
 *   topic = khash(ECDH-shared-secret,
 *                 "session" || sender(32) || receiver(32) || "/" || sP || "/" || rP)
 * Sender = device that posts; receiver = device that subscribes. Pins are
 * empty for own-device sessions (literal "//" tail).
 */

import { createAccountId, createSessionId } from '@novasamatech/statement-store';

/** Directional pair topic — `sender` posts here, `receiver` subscribes here. */
export function deriveDeviceSessionTopic(
  sharedSecret: Uint8Array,
  sender: { accountId: Uint8Array },
  receiver: { accountId: Uint8Array },
): Uint8Array {
  return createSessionId(
    sharedSecret,
    { accountId: createAccountId(sender.accountId), pin: undefined },
    { accountId: createAccountId(receiver.accountId), pin: undefined },
  );
}
