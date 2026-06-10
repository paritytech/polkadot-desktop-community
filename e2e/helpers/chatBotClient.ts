/**
 * HTTP client for the signing-bot's chat mode.
 *
 * Drives the bot that acts as a P2P chat peer for Desktop e2e tests.
 * Covers the minimum surface needed for PB-217 happy-path coverage:
 * - idempotent create + attest of a peer identity
 * - start discovery so incoming chat requests are auto-accepted
 * - poll received messages to confirm user→peer delivery
 *
 * See signing-bot/docs/CHAT_E2E_TESTING.md for the full API.
 */

export type ChatBotNetwork = 'stable' | 'preview' | 'unstable' | 'paseo-next';

export type ChatBotUserStatus = {
  username: string;
  network: ChatBotNetwork;
  attested: boolean;
  chatReady: boolean;
  liteUsername?: string;
};

export type ChatBotMessage = {
  messageId: string;
  direction: 'outgoing' | 'incoming';
  text: string;
  timestamp: number;
};

export class ChatBotClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`[ChatBotClient] ${method} ${path} → ${res.status}: ${text || '<empty>'}`);
    }
    return text ? JSON.parse(text) : null;
  }

  /**
   * Idempotently prepare a chat peer identity on the bot.
   * Creates the user if missing, attests if not yet attested, and confirms chatReady.
   * Returns the bot's SS58 address and liteUsername for downstream use.
   */
  async ensurePeerReady(params: {
    username: string;
    liteUsername: string;
    network: ChatBotNetwork;
    attestTimeoutMs?: number;
  }): Promise<{ address: string; liteUsername: string }> {
    const { username, liteUsername, network, attestTimeoutMs = 120_000 } = params;

    // 1. Create (idempotent — bot returns existing user if present)
    const created = await this.request<{ address: string; desiredLiteUsername?: string }>('POST', '/api/users', {
      username,
      network,
      liteUsername,
    });

    // 2. Check status; attest only if needed
    const status = await this.getChatStatus(username, network);
    if (!status.attested) {
      await this.attest(username, network, attestTimeoutMs);
    }

    // 3. Final readiness check
    const finalStatus = await this.getChatStatus(username, network);
    if (!finalStatus.chatReady || !finalStatus.liteUsername) {
      throw new Error(
        `[ChatBotClient] Peer ${username}@${network} not chat-ready after attest. status=${JSON.stringify(finalStatus)}`,
      );
    }

    return { address: created.address, liteUsername: finalStatus.liteUsername };
  }

  async getChatStatus(username: string, network: ChatBotNetwork): Promise<ChatBotUserStatus> {
    return this.request<ChatBotUserStatus>('GET', `/api/users/${encodeURIComponent(username)}/chat-status?network=${network}`);
  }

  /** Full user record (includes `address` SS58). chat-status does not currently expose this field. */
  async getUser(username: string, network: ChatBotNetwork): Promise<{ address: string; attested: boolean }> {
    return this.request('GET', `/api/users/${encodeURIComponent(username)}?network=${network}`);
  }

  async attest(username: string, network: ChatBotNetwork, timeoutMs = 120_000): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/users/${encodeURIComponent(username)}/attest?network=${network}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ network }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`[ChatBotClient] attest(${username}@${network}) → ${res.status}: ${await res.text()}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async startDiscovery(username: string, network: ChatBotNetwork): Promise<void> {
    await this.request('POST', '/api/chat/discovery/start', { username, network });
  }

  async stopDiscovery(username: string, network: ChatBotNetwork): Promise<void> {
    await this.request('POST', '/api/chat/discovery/stop', { username, network }).catch(() => {
      // Non-fatal: discovery may already be stopped.
    });
  }

  async listSessions(): Promise<{ sessionId: string; username: string; peerUsername?: string; peerAccountId: string }[]> {
    return this.request('GET', '/api/chat/sessions');
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/api/chat/sessions/${encodeURIComponent(sessionId)}`);
  }

  /**
   * Wipe every chat session owned by the given bot identity.
   * Used for per-scenario isolation — the bot's in-memory dedup for sent
   * requests may still linger, but the session and its encrypted channel are cleared.
   */
  async deleteAllSessionsForUser(username: string): Promise<number> {
    const sessions = await this.listSessions();
    const mine = sessions.filter(s => s.username === username);
    for (const s of mine) {
      await this.deleteSession(s.sessionId);
    }
    return mine.length;
  }

  async getMessages(params: { username: string; peer: string; network: ChatBotNetwork }): Promise<ChatBotMessage[]> {
    const qs = new URLSearchParams({
      username: params.username,
      peer: params.peer,
      network: params.network,
    });
    return this.request('GET', `/api/chat/messages?${qs.toString()}`);
  }

  async sendMessage(params: {
    username: string;
    peer: string;
    network: ChatBotNetwork;
    text: string;
  }): Promise<{ messageId: string }> {
    return this.request('POST', '/api/chat/messages', params);
  }

  /**
   * Make the bot initiate a chat session with a peer (bot-to-user direction).
   * The peer is identified by their liteUsername. The user's Desktop will
   * receive an incoming chat request that can be accepted/declined in the UI.
   */
  async createSessionWithPeer(params: {
    username: string;
    network: ChatBotNetwork;
    peer: string;
  }): Promise<{ sessionId: string; peerAccountId: string; peerUsername?: string }> {
    return this.request('POST', '/api/chat/sessions', params);
  }

  /**
   * Wait until an incoming message with the given text appears on the bot side.
   * Polls GET /api/chat/messages until match or timeout.
   */
  async waitForIncomingMessage(params: {
    username: string;
    peer: string;
    network: ChatBotNetwork;
    text: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<ChatBotMessage> {
    const { text, timeoutMs = 60_000, pollIntervalMs = 2_000, ...rest } = params;
    const deadline = Date.now() + timeoutMs;
    let lastError: Error | undefined;
    while (Date.now() < deadline) {
      try {
        const messages = await this.getMessages(rest);
        const hit = messages.find(m => m.direction === 'incoming' && m.text === text);
        if (hit) return hit;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error(
      `[ChatBotClient] Timed out waiting for incoming "${text}" on ${rest.username}@${rest.network} from ${rest.peer}.` +
        (lastError ? ` Last error: ${lastError.message}` : ''),
    );
  }
}
