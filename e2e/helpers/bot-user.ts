import crypto from 'crypto';

import { errorMessage } from './errors';

/**
 * Cloudflare in front of the signing-bot host occasionally
 * returns 502/503/504 for a few seconds at a time. We retry transient gateway
 * errors at the fetch layer so a single infra blip doesn't kill a 5-minute
 * chat-pair scenario.
 */
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);
const FETCH_MAX_ATTEMPTS = 4;
const FETCH_RETRY_BASE_MS = 1_000;

async function fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !TRANSIENT_HTTP_STATUSES.has(res.status) || attempt === FETCH_MAX_ATTEMPTS) {
        return res;
      }
      console.warn(
        `[BOT-USER] ${init?.method ?? 'GET'} ${input} returned ${res.status} (attempt ${attempt}/${FETCH_MAX_ATTEMPTS}); retrying...`,
      );
    } catch (err) {
      lastErr = err;
      if (attempt === FETCH_MAX_ATTEMPTS) throw err;
      console.warn(
        `[BOT-USER] ${init?.method ?? 'GET'} ${input} threw "${errorMessage(err)}" (attempt ${attempt}/${FETCH_MAX_ATTEMPTS}); retrying...`,
      );
    }
    await new Promise(resolve => setTimeout(resolve, FETCH_RETRY_BASE_MS * 2 ** (attempt - 1)));
  }
  // Unreachable — the loop either returns or throws.
  throw lastErr ?? new Error('[BOT-USER] fetchWithRetry exhausted retries');
}

/**
 * Signing-bot test user lifecycle.
 *
 * Per-run random usernames avoid the pairing/session collisions a shared static
 * identity (e.g. `desktoptest-authenticated`) caused between parallel CI jobs
 * in the matrix of OS × project.
 *
 * Lifecycle: generated once in `setup-bot-users`, reused by workers (fixtures
 * pull from the pool via `e2e/setup/bot-user-pool.ts`), DELETEd in
 * `teardown-bot-users`. `ensure()` here is used by the setup project and by
 * fallback paths when the pool is missing.
 */

// Must satisfy `/^[a-z]{6,}$/` — enforced by both the signing-bot (liteUsername)
// and the identity-backend (username on attest). No digits, only lowercase a–z.
const USER_PREFIX = 'testbot';
const SUFFIX_LENGTH = 10;
const USERNAME_REGEX = /^[a-z]{6,}$/;

/**
 * Pure random `testbot<10lc>` generator. Used by callers that need a distinct
 * identity regardless of the `BOT_USERNAME` env (e.g. pool setup picking 6
 * separate usernames; chat-pair fallback with distinct Alice and Bob).
 */
export function generateBotUsername(): string {
  const bytes = crypto.randomBytes(SUFFIX_LENGTH);
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += String.fromCharCode(97 + ((bytes[i] ?? 0) % 26));
  }
  const username = `${USER_PREFIX}${suffix}`;
  if (!USERNAME_REGEX.test(username)) {
    throw new Error(`Generated bot username "${username}" does not match ${USERNAME_REGEX}`);
  }
  return username;
}

/**
 * Env-aware wrapper — honours `BOT_USERNAME` for single-project manual repro.
 * Prefer `generateBotUsername()` when multiple distinct identities are needed
 * in one process (env override would collide them).
 */
export function makeBotUsername(): string {
  return process.env['BOT_USERNAME'] ?? generateBotUsername();
}

type BotRequestOptions = {
  botUrl: string;
  botToken: string | undefined;
};

type UserRequestOptions = BotRequestOptions & {
  username: string;
  network: string;
};

function headers(botToken: string | undefined): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (botToken) h['Authorization'] = `Bearer ${botToken}`;
  return h;
}

/**
 * Idempotently create + attest the bot user for the given network.
 * - POST /api/users — returns existing user if it already exists.
 * - POST /api/users/:username/attest — no-op if already attested.
 *
 * Attestation is on-chain, takes 30–60s on first call.
 */
async function createBotUser({ username, network, botUrl, botToken }: UserRequestOptions): Promise<{ attested: boolean }> {
  const res = await fetchWithRetry(`${botUrl}/api/users`, {
    method: 'POST',
    headers: headers(botToken),
    body: JSON.stringify({ username, network }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`POST /api/users failed (${res.status}): ${body}`);
  }

  const data: { attested?: boolean } = await res.json();
  return { attested: !!data.attested };
}

async function attestBotUser({ username, network, botUrl, botToken }: UserRequestOptions): Promise<void> {
  const res = await fetchWithRetry(`${botUrl}/api/users/${encodeURIComponent(username)}/attest?network=${encodeURIComponent(network)}`, {
    method: 'POST',
    headers: headers(botToken),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`POST /api/users/${username}/attest failed (${res.status}): ${body}`);
  }
}

/**
 * Poll the bot until it confirms the user is attested on-chain. The attest
 * HTTP response returns as soon as the tx is submitted — chain finality can
 * lag by tens of seconds. Signing in before finality fails silently
 * (`waitForURL(/dashboard/)` times out), so every ensure() blocks on this.
 */
async function waitUntilAttested({
  username,
  network,
  botUrl,
  botToken,
  timeoutMs = 120_000,
  intervalMs = 3_000,
}: UserRequestOptions & { timeoutMs?: number; intervalMs?: number }): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // Plain fetch — the polling loop is itself the retry, so we don't
    // double-stack delays on transient 5xx.
    const res = await fetch(`${botUrl}/api/users/${encodeURIComponent(username)}?network=${encodeURIComponent(network)}`, {
      method: 'GET',
      headers: headers(botToken),
    }).catch(() => null);
    if (res?.ok) {
      const data: { attested?: boolean } = await res.json().catch(() => ({}));
      if (data.attested) return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`[BOT-USER] Timed out waiting for "${username}"@${network} to reach attested=true`);
}

/**
 * Best-effort DELETE of a pooled bot user. Logs outcome, swallows errors —
 * teardown runs once per test-run and shouldn't fail CI on a stray 500.
 */
export async function deleteBotUser({ username, network, botUrl, botToken }: UserRequestOptions): Promise<void> {
  try {
    const res = await fetch(`${botUrl}/api/users/${encodeURIComponent(username)}?network=${encodeURIComponent(network)}`, {
      method: 'DELETE',
      headers: headers(botToken),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const result: { deleted?: boolean } = await res.json().catch(() => ({}));
      console.info(`[BOT-USER] Deleted "${username}"@${network}: ${result.deleted ?? 'unknown'}`);
    } else {
      console.warn(`[BOT-USER] DELETE "${username}"@${network} failed: ${res.status}`);
    }
  } catch (err) {
    console.warn(`[BOT-USER] DELETE "${username}"@${network} error (best-effort):`, errorMessage(err));
  }
}

/**
 * Per-(username) create+attest session. `ensure(network)` caches on the
 * instance so repeated calls within a worker avoid the round-trip to /api/users.
 * Cleanup happens in `teardown-bot-users`, not here.
 */
export class BotUserSession {
  private readonly ensuredNetworks = new Set<string>();

  constructor(
    readonly username: string,
    private readonly botUrl: string,
    private readonly botToken: string | undefined,
  ) {
    if (!botUrl) {
      throw new Error('BOT_URL env var is required for tests that sign in via the signing bot');
    }
  }

  async ensure(network: string): Promise<void> {
    if (this.ensuredNetworks.has(network)) return;

    console.info(`[BOT-USER] Ensuring "${this.username}"@${network}...`);
    const opts = { username: this.username, network, botUrl: this.botUrl, botToken: this.botToken };
    const { attested } = await createBotUser(opts);

    if (!attested) {
      console.info(`[BOT-USER] Attesting "${this.username}"@${network} (on-chain, may take 30–60s)...`);
      await attestBotUser(opts);
      await waitUntilAttested(opts);
    }

    this.ensuredNetworks.add(network);
    console.info(`[BOT-USER] "${this.username}"@${network} ready`);
  }
}
