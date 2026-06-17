/**
 * Pure helpers for P2P chat push notifications: push-id derivation and
 * token/byte format conversions. The HTTP send path lives in `gateway.ts`.
 *
 * Mirrors Android's RealPushNotificationHelper / ChatPushTokenUtils.
 */

import { khash } from '@novasamatech/statement-store';

import { p2pService } from '../service';

const NOTIFICATION_PREFIX = new TextEncoder().encode('notification');

/**
 * Compute push notification ID.
 * pushId = khash(sharedSecret, "notification" + SessionIdParam(local, remote))
 */
function computePushId(sharedSecret: Uint8Array, localAccountId: Uint8Array, remoteAccountId: Uint8Array): Uint8Array {
  const sessionIdParam = p2pService.buildSessionIdParam(localAccountId, remoteAccountId);
  const message = new Uint8Array(NOTIFICATION_PREFIX.length + sessionIdParam.length);
  message.set(NOTIFICATION_PREFIX, 0);
  message.set(sessionIdParam, NOTIFICATION_PREFIX.length);

  return khash(sharedSecret, message);
}

/**
 * Convert a Uint8Array to a hex string without 0x prefix.
 */
function bytesToHexString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex-encoded UTF-8 bytes back to the original string.
 * Android FCM tokens are stored as hex(UTF-8 bytes) by the Hex() codec,
 * but the push backend expects the raw FCM token string.
 */
const hexToUtf8 = (hex: string): string => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return new TextDecoder().decode(bytes);
};

/**
 * Get the platform-appropriate device token string for the push API.
 *
 * iOS APNS tokens are raw bytes → hex string is the correct API format.
 * Android FCM tokens are UTF-8 strings → need to decode hex back to the original string.
 *
 * Mirrors Android's ChatPushTokenUtils.getPlatformToken().
 */
function getPlatformDeviceToken(storedHexToken: string, platform: 'Android' | 'iOS' | undefined): string {
  if (platform === 'Android') {
    return hexToUtf8(storedHexToken);
  }

  // iOS or unknown — hex string is correct
  return storedHexToken;
}

export const pushNotificationService = {
  computePushId,
  bytesToHexString,
  getPlatformDeviceToken,
};
