/**
 * Autotest mode — signing bot integration.
 *
 * Runtime configuration via Electron preload bridge (window.App):
 *   AUTOTEST=true npm run start:electron
 *   AUTOTEST=true BOT_URL=<bot-url> BOT_TOKEN=<token> npm run start:electron
 *
 * For e2e tests, these env vars are passed to the Electron process at launch time.
 * No separate build needed — the same production build works for both normal and e2e runs.
 */

const isElectron = typeof window !== 'undefined' && !!window.App;

export const AUTOTEST_ENABLED = isElectron ? !!window.App.autotest : false;
export const E2E_TEST_ENABLED = isElectron ? !!window.App.e2eTest : false;
export const DEFAULT_BOT_URL = isElectron ? (window.App.botUrl ? window.App.botUrl : '') : '';
export const DEFAULT_BOT_TOKEN = isElectron ? (window.App.botToken ?? '') : '';

if (AUTOTEST_ENABLED) {
  console.info(
    '%c[AUTOTEST]%c Mode enabled — default bot URL: %s',
    'color: #58a6ff; font-weight: bold',
    'color: inherit',
    DEFAULT_BOT_URL,
  );
}

export type BotStatus = 'idle' | 'connecting' | 'pairing' | 'paired' | 'error';

export type PairResult = {
  sessionId: string;
  clientId: string;
  user: { username: string; publicKeyHex: string; address: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires interface
  interface Window {
    __botPairingInfo?: { clientId: string; sessionId: string; botUrl: string; botToken?: string };
  }
}

/**
 * Check if signing bot is reachable.
 */
export async function checkBotHealth(botUrl: string, token?: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${botUrl}/api/health`, { headers, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send the QR pairing payload to the signing bot.
 */
export async function pairViaBotApi(
  botUrl: string,
  qrPayload: string,
  options?: { username?: string; network?: string; token?: string },
): Promise<PairResult> {
  const { username, network, token } = options ?? {};
  const clientId = crypto.randomUUID();
  const url = `${botUrl}/api/pair`;

  console.info('[AUTOTEST] Sending pairing payload to bot...', {
    url,
    username: username || '(auto)',
    network: network || 'paseo-next',
    clientId,
    payloadLength: qrPayload.length,
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      handshake: qrPayload,
      network: network || 'paseo-next',
      username: username || undefined,
      clientId,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[AUTOTEST] Bot pairing failed:', response.status, body);
    throw new Error(`Bot pairing failed (${response.status}): ${body}`);
  }

  const result = await response.json();
  console.info('[AUTOTEST] Bot pairing succeeded:', {
    sessionId: result.sessionId,
    username: result.user?.username,
    clientId,
  });

  // Store pairing info on window so e2e fixtures can retrieve it for cleanup
  window.__botPairingInfo = { clientId, sessionId: result.sessionId, botUrl, botToken: token };

  return { ...result, clientId };
}

/**
 * Disconnect sessions from the signing bot by clientId.
 */
export async function disconnectFromBot(
  botUrl: string,
  clientId: string,
  token?: string,
): Promise<{ disconnected: boolean; count: number }> {
  const url = `${botUrl}/api/disconnect`;

  console.info('[AUTOTEST] Disconnecting bot sessions...', { url, clientId });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clientId }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.warn('[AUTOTEST] Bot disconnect failed:', response.status, body);
    return { disconnected: false, count: 0 };
  }

  const result = await response.json();
  console.info('[AUTOTEST] Bot disconnect result:', result);

  return result;
}
