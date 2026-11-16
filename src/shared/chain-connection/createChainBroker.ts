import {
  type JsonRpcConnection,
  type JsonRpcMessage,
  type JsonRpcProvider,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@polkadot-api/json-rpc-provider';

import {
  type BrokerConnection,
  type OwnedToken,
  type RequestOwner,
  type Session,
  type SubscriptionMessage,
  CHAIN_HEAD_FOLLOW,
  CHAIN_HEAD_UNFOLLOW,
  RELEASE_METHODS,
  TOKEN_METHODS,
  buildJsonRpcResult,
  cloneWithRewrittenFirstParam,
  createJsonRpcError,
  getErrorMessage,
  getReleaseResult,
  isRecord,
  isRequestMessage,
  isResponseMessage,
  isSubscriptionEnd,
  isSubscriptionMessage,
  readdressSubscription,
} from './brokerMessages';
import { type BrokerWarner, createBrokerWarner, logBrokerTraffic } from './createBrokerWarner';
import { createEarlySubscriptions } from './createEarlySubscriptions';
import { createOwnedTokens } from './createOwnedTokens';
import { createPendingRequests } from './createPendingRequests';
import { runEvery } from './runEvery';

// Many JSON-RPC sessions over one upstream connection, with ids and subscription tokens rewritten per session.
export type ChainBroker = ReturnType<typeof createChainBroker>;

type Params = {
  // Opened with the first session, closed by `disconnectAll`.
  provider: JsonRpcProvider;
  // Passed by an owner that rebuilds brokers for one chain, so a rebuild keeps that chain's count.
  warn?: BrokerWarner;
};

type ConnectParams = {
  // Names the session in the local tokens it gets. Unique among the broker's open sessions.
  sessionId: string;
  onMessage: (message: JsonRpcMessage) => void;
};

type UpstreamState = { kind: 'closed' } | { kind: 'opening' } | { kind: 'open'; connection: JsonRpcConnection };

export function createChainBroker({ provider, warn = createBrokerWarner() }: Params) {
  let state: UpstreamState = { kind: 'closed' };
  const sessions = new Map<string, Session>();
  const pending = createPendingRequests({ sendUpstream });
  const earlySubscriptions = createEarlySubscriptions({ warn, deliver: handleUpstreamSubscription });
  const ownedTokens = createOwnedTokens();

  // Opens a session, and the upstream with the first one. Throws when `sessionId` names an open session, and throws what
  // the provider throws as the upstream opens, after which the next `connect` opens it again. A broker closed while its
  // upstream opens, or a `connect` made from inside the provider call that opens it, returns a connection that drops what
  // it sends and adds no session.
  function connect({ sessionId, onMessage }: ConnectParams): BrokerConnection {
    if (sessions.has(sessionId)) {
      throw new Error(`Duplicate broker session: ${sessionId}`);
    }

    logBrokerTraffic(`Session ${sessionId} connecting (${String(sessions.size)} existing sessions)`);
    ensureUpstream();
    if (state.kind !== 'open') {
      return createUnservedConnection(sessionId);
    }
    sessions.set(sessionId, { id: sessionId, onMessage });

    return {
      send: message => {
        sendFromSession(sessionId, message);
      },
      disconnect: () => {
        disconnectSession(sessionId);
      },
    };
  }

  // Ends every session, releasing what each holds upstream, then closes the upstream. Every step runs even when one
  // throws. A later `connect` reopens the upstream.
  function disconnectAll(): void {
    runEvery(
      [
        ...[...sessions.keys()].map(sessionId => () => {
          disconnectSession(sessionId);
        }),
        disconnectUpstream,
      ],
      'chain broker: closing every session and the upstream failed',
    );
  }

  function sendUpstream(message: JsonRpcRequest): void {
    if (state.kind === 'open') {
      state.connection.send(message);
    }
  }

  // Forwards a session's request, its tokens already rewritten, owned by the session when it expects an answer. A follow
  // sent without an id is still tracked, so the follows the node holds stay counted, and its answer is unfollowed at once.
  function forwardForSession(session: Session, request: JsonRpcRequest): void {
    const { method } = request;
    if (request.id !== undefined) {
      pending.track({ owner: { kind: 'session', session, clientId: request.id, method }, request });
      return;
    }
    if (method === CHAIN_HEAD_FOLLOW) {
      pending.track({ owner: { kind: 'orphan', method }, request });
      return;
    }
    sendUpstream(request);
  }

  // A release the broker sends itself, for something no session holds anymore.
  function sendRelease({ releaseMethod, upstreamToken }: Pick<OwnedToken, 'releaseMethod' | 'upstreamToken'>): void {
    pending.track({
      owner: { kind: 'release', method: releaseMethod, upstreamToken },
      request: { jsonrpc: '2.0', method: releaseMethod, params: [upstreamToken] },
    });
  }

  // The follows the node may count on this connection now: follow tokens sessions hold (each upstream token once), follow
  // requests in flight, and unfollows in flight from a session or the broker.
  function countFollows(): number {
    let inFlight = 0;
    for (const owner of pending.listOwners()) {
      const method = owner.method;
      if (method === CHAIN_HEAD_FOLLOW || method === CHAIN_HEAD_UNFOLLOW) {
        inFlight += 1;
      }
    }
    return ownedTokens.countUpstream(CHAIN_HEAD_UNFOLLOW) + inFlight;
  }

  // Opens the upstream from `closed`. Throws what the provider throws, and returns an unchanged `opening` to `closed`.
  function ensureUpstream(): void {
    if (state.kind !== 'closed') {
      return;
    }
    logBrokerTraffic(`Connecting to upstream provider... (sessions: [${[...sessions.keys()].join(',')}])`);
    const opening: UpstreamState = { kind: 'opening' };
    state = opening;
    let connection: JsonRpcConnection;
    try {
      connection = provider(message => {
        // A message from an upstream the broker closed or abandoned is dropped.
        if (state.kind === 'open' && state.connection === connection) {
          handleUpstreamMessage(message);
        }
      });
    } catch (error) {
      if (state === opening) {
        state = { kind: 'closed' };
      }
      throw error;
    }
    // The owner may close the broker from inside the provider call.
    if (state !== opening) {
      closeAbandonedUpstream(connection);
      return;
    }
    state = { kind: 'open', connection };
    logBrokerTraffic(`Upstream provider connected (send=${typeof connection.send}, disconnect=${typeof connection.disconnect})`);
  }

  // Closes an upstream the broker closed while it opened. A failed close is warned, never thrown.
  function closeAbandonedUpstream(connection: JsonRpcConnection): void {
    try {
      connection.disconnect();
    } catch (error) {
      warn('upstream_close_failed', `closing an upstream closed while it opened failed: ${getErrorMessage(error)}`);
    }
  }

  // A connection for a session the broker cannot serve, which drops what it sends.
  function createUnservedConnection(sessionId: string): BrokerConnection {
    logBrokerTraffic(`Session ${sessionId} not served, as the upstream is ${state.kind}`);
    return {
      send: () => {
        warnNotConnected(sessionId);
      },
      disconnect: () => undefined,
    };
  }

  function warnNotConnected(sessionId: string): void {
    warn('session_not_connected', `sendFromSession: session ${sessionId} not connected, dropping message`);
  }

  // `message` is typed a request, which a session's code does not guarantee at runtime.
  function sendFromSession(sessionId: string, message: unknown): void {
    const session = sessions.get(sessionId);
    if (session === undefined) {
      warnNotConnected(sessionId);
      return;
    }

    if (Array.isArray(message)) {
      session.onMessage(createJsonRpcError(null, 'Batch JSON-RPC is unsupported'));
      return;
    }

    if (!isRequestMessage(message)) {
      warn('session_not_request', `sendFromSession: not a request from session ${sessionId}`);
      session.onMessage(createJsonRpcError(null, 'Invalid JSON-RPC request'));
      return;
    }

    logBrokerTraffic(`to upstream [${sessionId}] method=${message.method} id=${String(message.id)}`);
    routeGenericRequest(session, message);
  }

  // Rewrites a session-owned token to its upstream token and forwards the request.
  function routeGenericRequest(session: Session, request: JsonRpcRequest): void {
    const { method } = request;
    if (RELEASE_METHODS.has(method)) {
      routeOwnedReleaseRequest(session, request);
      return;
    }

    const rewritten = rewriteOwnedToken(session, request);
    if (rewritten === null) {
      warn('request_unknown_token', `routeGenericRequest: unknown token for session ${session.id}, method=${method}`);
      session.onMessage(createJsonRpcError(request.id ?? null, 'Unknown subscription/token'));
      return;
    }

    forwardForSession(session, rewritten);
  }

  function routeOwnedReleaseRequest(session: Session, request: JsonRpcRequest): void {
    const { method } = request;
    const owned = findOwnedToken(request);
    // No warning: a session releases a subscription the node already ended, as after a final event, in the usual run.
    if (owned?.session !== session || owned.releaseMethod !== method) {
      session.onMessage(createJsonRpcError(request.id ?? null, 'Unknown subscription/token'));
      return;
    }

    const { upstreamToken } = owned;
    if (!ownedTokens.release(owned.localToken)) {
      if (request.id !== undefined) {
        session.onMessage(buildJsonRpcResult(request.id, getReleaseResult(method)));
      }
      return;
    }

    // Tracked with its token even without an id, as the node may send events it queued for the subscription until it
    // answers, and an unfollow counts as a follow until then.
    pending.track({
      owner:
        request.id === undefined
          ? { kind: 'release', method, upstreamToken }
          : { kind: 'session', session, clientId: request.id, method, upstreamToken },
      request: cloneWithRewrittenFirstParam(request, upstreamToken),
    });
  }

  function rewriteOwnedToken(session: Session, request: JsonRpcRequest): JsonRpcRequest | null {
    const owned = findOwnedToken(request);
    if (owned === undefined) {
      return request;
    }
    if (owned.session !== session) {
      return null;
    }

    return cloneWithRewrittenFirstParam(request, owned.upstreamToken);
  }

  // The owned token a request names as its first param, or undefined when it names none.
  function findOwnedToken(request: JsonRpcRequest): Readonly<OwnedToken> | undefined {
    const localToken: unknown = Array.isArray(request.params) ? request.params[0] : undefined;
    return typeof localToken === 'string' ? ownedTokens.find(localToken) : undefined;
  }

  // `message` is typed a JSON-RPC message, which the node does not guarantee at runtime.
  function handleUpstreamMessage(message: unknown): void {
    if (Array.isArray(message)) {
      warn('upstream_batch', `from upstream: unexpected batch message, ignoring`);
      return;
    }

    if (isSubscriptionMessage(message)) {
      handleUpstreamSubscription(message);
      return;
    }

    if (isResponseMessage(message)) {
      handleUpstreamResponse(message);
      return;
    }

    warn('upstream_unrecognized', `from upstream: unrecognized message type`);
  }

  function handleUpstreamResponse(response: JsonRpcResponse): void {
    const id = String(response.id);
    const owner = pending.take(id);
    if (owner === undefined) {
      warn('response_unknown_id', `from upstream: response for unknown id=${id}`);
      return;
    }
    if (owner.method === CHAIN_HEAD_FOLLOW && 'error' in response) {
      // Typed an error object, which the node does not guarantee at runtime.
      const error: unknown = response.error;
      logBrokerTraffic(`Follow refused by upstream with code ${String(isRecord(error) ? error['code'] : undefined)}`);
    }
    answerOwner(owner, response);
  }

  function answerOwner(owner: RequestOwner, response: JsonRpcResponse): void {
    switch (owner.kind) {
      case 'orphan':
        answerOrphan(owner.method, response);
        return;
      case 'release':
        answerRelease(owner.method, response);
        return;
      case 'session':
        answerSession(owner, response);
        return;
    }
  }

  function answerSession(owner: Extract<RequestOwner, { kind: 'session' }>, response: JsonRpcResponse): void {
    const { session } = owner;
    const answer = { ...response, id: owner.clientId };
    const opened = readOpenedSubscription(owner.method, response);
    if (opened === null) {
      session.onMessage(answer);
      return;
    }
    const { upstreamToken } = opened;
    const localToken = ownedTokens.mapToken({ session, ...opened });
    logBrokerTraffic(`Token mapped: ${localToken} to ${upstreamToken} (${owner.method})`);
    session.onMessage({ ...answer, result: localToken });
    earlySubscriptions.flush(upstreamToken);
  }

  // The answer to a request no session waits on, as its session left while it was in flight or it was a follow sent
  // without an id. A subscription it opened would run upstream for the broker's life, so it is released at once, unless
  // a session still holds the same upstream subscription.
  function answerOrphan(method: string, response: JsonRpcResponse): void {
    const opened = readOpenedSubscription(method, response);
    if (opened === null) {
      logBrokerTraffic(`Dropped the answer to ${method}, which no session waits on`);
      return;
    }
    if (ownedTokens.listOwners(opened.upstreamToken).length > 0) {
      return;
    }
    earlySubscriptions.drop(opened.upstreamToken);
    sendRelease(opened);
  }

  // Nobody waits on a release, so the node refusing one is all there is to tell.
  function answerRelease(method: string, response: JsonRpcResponse): void {
    if ('error' in response) {
      warn('release_refused', `upstream refused ${method}: ${JSON.stringify(response.error)}`);
    }
  }

  function handleUpstreamSubscription(message: SubscriptionMessage): void {
    const upstreamToken = message.params?.subscription;
    if (typeof upstreamToken !== 'string') {
      warn('subscription_bad_token', `from upstream: subscription with non-string token`);
      return;
    }

    const owners = ownedTokens.listOwners(upstreamToken);
    if (owners.length === 0) {
      handleUnownedEvent(upstreamToken, message);
      return;
    }

    // Released before anyone hears the final event, as a stopped follow is, so a release sent from inside that delivery
    // is answered locally instead of going upstream for a subscription the node already ended.
    const eventResult = message.params?.result;
    const ends = isRecord(eventResult) && isSubscriptionEnd(message.method, eventResult['event']);
    if (ends) {
      logBrokerTraffic(`Token ended by upstream: ${upstreamToken}`);
      for (const { localToken } of owners) {
        ownedTokens.release(localToken);
      }
    }

    for (const owned of owners) {
      // An earlier delivery can end this session or release its token.
      const sessionLive = sessions.get(owned.session.id) === owned.session;
      // A final event still reaches every token it ended.
      const tokenHeld = ends || ownedTokens.has(owned.localToken);
      if (!sessionLive || !tokenHeld) {
        continue;
      }
      owned.session.onMessage(readdressSubscription(message, owned.localToken));
    }
  }

  // Handles an event for a token no session owns. One for a subscription being released is dropped, and one that may
  // come before its subscription's answer waits for it.
  function handleUnownedEvent(upstreamToken: string, message: SubscriptionMessage): void {
    // Queued by the node before it read the release, so expected, and nobody will ever map this token again.
    if (pending.isReleasing(upstreamToken)) {
      logBrokerTraffic(`Dropped an event for released subscription ${upstreamToken}`);
      return;
    }
    if (pending.hasSubscriptionRequest()) {
      earlySubscriptions.buffer(upstreamToken, message);
      return;
    }
    warn('subscription_unknown_token', `from upstream: subscription for unknown token: ${upstreamToken}`);
  }

  function disconnectSession(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }
    const owned = ownedTokens.listSessionTokens(session);
    logBrokerTraffic(
      `disconnectSession(${sessionId}) called, pending=${String(pending.count())}, tokens=${String(owned.length)}`,
    );
    sessions.delete(sessionId);

    // An answer still on its way may open a subscription, which nobody would release once its session has gone.
    pending.orphanSession(session);

    // Each token is released even when an earlier release fails upstream, so none stays owned by a gone session.
    runEvery(
      owned.map(token => () => {
        if (ownedTokens.release(token.localToken)) {
          sendRelease(token);
        }
      }),
      `chain broker: releasing what session ${sessionId} held failed`,
    );
  }

  // Forgets what the upstream held, then closes it when it was open. Throws what the close throws.
  function disconnectUpstream(): void {
    const previous = state;
    // Written first, so a close that throws still leaves the upstream closed.
    state = { kind: 'closed' };
    pending.clear();
    ownedTokens.clear();
    earlySubscriptions.clear();
    if (previous.kind === 'open') {
      previous.connection.disconnect();
    }
  }

  return {
    connect,
    disconnectAll,
    countFollows,
    // Whether a session of this broker holds `localToken`.
    hasToken: ownedTokens.has,
  };
}

// The subscription an answer to `method` opened, or null when it opened none.
function readOpenedSubscription(
  method: string,
  response: JsonRpcResponse,
): Pick<OwnedToken, 'releaseMethod' | 'upstreamToken'> | null {
  const releaseMethod = TOKEN_METHODS.get(method);
  if (releaseMethod === undefined || !('result' in response) || typeof response.result !== 'string') {
    return null;
  }
  return { releaseMethod, upstreamToken: response.result };
}
