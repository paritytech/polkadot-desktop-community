/**
 * Push notification sending for P2P chat.
 *
 * After a message is confirmed delivered to the statement store,
 * sends a fire-and-forget HTTP POST to the push notification backend
 * so the recipient's device gets a push notification.
 *
 * Mirrors Android's RealPushNotificationHelper / ChatPushNotificationsSender.
 */

import { type MessageContent, ChatMessage as ChatMessageCodec } from '@novasamatech/host-chat/codec/message';
import { type Encryption, khash } from '@novasamatech/statement-store';
import { type CodecType } from 'scale-ts';

import { type EnvironmentId, environmentUseCase } from '@/domains/application';

type MessageContentType = CodecType<typeof MessageContent>;

const NOTIFICATION_PREFIX = new TextEncoder().encode('notification');
const SEPARATOR = new TextEncoder().encode('/');

/**
 * Build SessionIdParam(A, B) = AccountId(A) + AccountId(B) + "/" + "/"
 * No PINs for desktop.
 */
const buildSessionIdParam = (accountIdA: Uint8Array, accountIdB: Uint8Array): Uint8Array => {
  const len = accountIdA.length + accountIdB.length + SEPARATOR.length + SEPARATOR.length;
  const result = new Uint8Array(len);
  let offset = 0;
  result.set(accountIdA, offset);
  offset += accountIdA.length;
  result.set(accountIdB, offset);
  offset += accountIdB.length;
  result.set(SEPARATOR, offset);
  offset += SEPARATOR.length;
  result.set(SEPARATOR, offset);

  return result;
};

/**
 * Compute push notification ID.
 * pushId = khash(sharedSecret, "notification" + SessionIdParam(local, remote))
 */
export const computePushId = (sharedSecret: Uint8Array, localAccountId: Uint8Array, remoteAccountId: Uint8Array): Uint8Array => {
  const sessionIdParam = buildSessionIdParam(localAccountId, remoteAccountId);
  const message = new Uint8Array(NOTIFICATION_PREFIX.length + sessionIdParam.length);
  message.set(NOTIFICATION_PREFIX, 0);
  message.set(sessionIdParam, NOTIFICATION_PREFIX.length);

  return khash(sharedSecret, message);
};

export const getPushNotifyUrl = async (environmentId: EnvironmentId): Promise<string> => {
  return `${(await environmentUseCase.getById(environmentId)).backendUrl}/api/v1/notify`;
};

/**
 * Convert a Uint8Array to a hex string without 0x prefix.
 */
export const bytesToHexString = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const VOIP_CONTENT_TAGS = new Set(['dataChannelOffer', 'dataChannelAnswer', 'dataChannelCandidates']);

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
export const getPlatformDeviceToken = (storedHexToken: string, platform: 'Android' | 'iOS' | undefined): string => {
  if (platform === 'Android') {
    return hexToUtf8(storedHexToken);
  }

  // iOS or unknown — hex string is correct
  return storedHexToken;
};

export type SendPushNotificationParams = {
  deviceToken: string;
  peerPlatform: 'Android' | 'iOS' | undefined;
  sharedSecret: Uint8Array;
  encryption: Encryption;
  localAccountId: Uint8Array;
  remoteAccountId: Uint8Array;
  messageId: string;
  timestamp: number;
  content: MessageContentType;
  environmentId: EnvironmentId;
};

/**
 * Send a push notification to the peer's device. Fire-and-forget.
 *
 * 1. SCALE-encode the ChatMessage
 * 2. Encrypt with the session's AES-256-GCM encryption
 * 3. POST to the push backend
 */
export const sendPushNotification = async (params: SendPushNotificationParams): Promise<void> => {
  const {
    deviceToken,
    peerPlatform,
    sharedSecret,
    encryption,
    localAccountId,
    remoteAccountId,
    messageId,
    timestamp,
    content,
    environmentId,
  } = params;

  const environment = await environmentUseCase.getById(environmentId);

  try {
    // 1. Compute pushId
    const pushId = computePushId(sharedSecret, localAccountId, remoteAccountId);

    // 2. SCALE-encode the ChatMessage
    const encoded = ChatMessageCodec.enc({
      messageId,
      timestamp: BigInt(timestamp),
      versioned: { tag: 'v1' as const, value: content },
    });

    // 3. Encrypt
    const encryptResult = encryption.encrypt(encoded);
    if (encryptResult.isErr()) {
      console.warn('[push-notification] Encryption failed:', encryptResult.error);

      return;
    }

    // 4. Build request body — convert device token to platform-appropriate format
    const platformToken = getPlatformDeviceToken(deviceToken, peerPlatform);
    const body: Record<string, unknown> = {
      deviceToken: platformToken,
      pushId: bytesToHexString(pushId),
      message: bytesToHexString(encryptResult.value),
      voip: VOIP_CONTENT_TAGS.has(content.tag),
    };

    // iOS needs platform + bundlerId (APNs topic) for the backend to route via APNs.
    // Without these the backend defaults to FCM (Android) and fails.
    // Mirrors iOS APNSClientService's NotifyRequestParameters.
    if (peerPlatform === 'iOS') {
      body['platform'] = 'ios';
      body['bundlerId'] = environment.iosBundleId;
    } else if (peerPlatform === 'Android') {
      body['platform'] = 'android';
    }

    // 5. POST (fire-and-forget) — use Electron main process to bypass CORS
    const url = `${environment.backendUrl}/api/v1/notify`;
    const bodyStr = JSON.stringify(body);

    let status: number;
    if (typeof window !== 'undefined' && window.App?.proxyFetch) {
      const res = await window.App.proxyFetch({
        url,
        method: 'POST',
        headers: [['Content-Type', 'application/json']],
        body: new TextEncoder().encode(bodyStr),
      });
      status = res.status;
    } else {
      const fetchRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
      status = fetchRes.status;
    }

    if (status < 200 || status >= 300) {
      console.warn('[push-notification] Backend returned', status, 'for message', messageId);
    }
  } catch (e) {
    console.warn('[push-notification] Failed to send:', e);
  }
};
