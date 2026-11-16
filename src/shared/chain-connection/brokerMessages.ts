import { type JsonRpcId, type JsonRpcMessage, type JsonRpcRequest, type JsonRpcResponse } from '@polkadot-api/json-rpc-provider';

export const CHAIN_HEAD_FOLLOW = 'chainHead_v1_follow';
export const CHAIN_HEAD_UNFOLLOW = 'chainHead_v1_unfollow';
const STATEMENT_SUBSCRIBE = 'statement_subscribeStatement';
const STATEMENT_UNSUBSCRIBE = 'statement_unsubscribeStatement';
const TRANSACTION_BROADCAST = 'transaction_v1_broadcast';
const TRANSACTION_STOP = 'transaction_v1_stop';
const SUBMIT_AND_WATCH = 'transactionWatch_v1_submitAndWatch';
const UNWATCH = 'transactionWatch_v1_unwatch';
const WATCH_EVENT = 'transactionWatch_v1_watchEvent';
// The watch events after which the node ends the watch on its own.
const TERMINAL_WATCH_EVENTS: ReadonlySet<string> = new Set(['finalized', 'error', 'invalid', 'dropped']);

export const TOKEN_METHODS: ReadonlyMap<string, string> = new Map<string, string>([
  [CHAIN_HEAD_FOLLOW, CHAIN_HEAD_UNFOLLOW],
  [TRANSACTION_BROADCAST, TRANSACTION_STOP],
  [SUBMIT_AND_WATCH, UNWATCH],
  [STATEMENT_SUBSCRIBE, STATEMENT_UNSUBSCRIBE],
]);
export const RELEASE_METHODS: ReadonlySet<string> = new Set<string>(TOKEN_METHODS.values());

export type SubscriptionMessage = JsonRpcRequest<{ subscription: unknown; result?: unknown }>;

export type Session = {
  id: string;
  onMessage: (message: JsonRpcMessage) => void;
};

export type BrokerConnection = {
  // Dropped once the session is gone.
  send: (message: JsonRpcRequest) => void;
  // Ends the session and releases what it holds. A repeated call does nothing.
  disconnect: () => void;
};

// Who the answer to an upstream request goes to. Each request the broker sends upstream with an id has exactly one owner
// (a session, a session that left or a release the broker sent itself), so an answer is never routed by guessing what its
// id holds.
export type RequestOwner =
  // A session's own request, answered to the session under its own id. A session that leaves hands it to an orphan owner.
  // A release it sends as the last owner carries `upstreamToken`, since the node may still send events it queued for that
  // subscription.
  | { kind: 'session'; session: Session; clientId: JsonRpcId; method: string; upstreamToken?: string | undefined }
  // A request whose session left before the answer, or a follow a session sent without an id. A subscription the answer
  // opens is released at once. A release keeps its `upstreamToken` for the events the node may still send for it.
  | { kind: 'orphan'; method: string; upstreamToken?: string | undefined }
  // A release the broker sent itself for `upstreamToken`. Nobody waits on its answer, and until it comes the node may still
  // send events it queued for that subscription.
  | { kind: 'release'; method: string; upstreamToken: string };

export type OwnedToken = {
  session: Session;
  localToken: string;
  upstreamToken: string;
  releaseMethod: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createJsonRpcError(id: JsonRpcId, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code: -32603, message } };
}

export function buildJsonRpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function readdressSubscription(message: SubscriptionMessage, localToken: string): SubscriptionMessage {
  return { ...message, params: { ...message.params, subscription: localToken } };
}

export function cloneWithRewrittenFirstParam(request: JsonRpcRequest, token: string): JsonRpcRequest {
  const params: unknown[] = Array.isArray(request.params) ? request.params.slice() : [];
  params[0] = token;
  return { ...request, params };
}

export function getReleaseResult(method: string): unknown {
  return method === STATEMENT_UNSUBSCRIBE ? true : null;
}

// Whether `event` ends its subscription on the node's side, so nothing is sent upstream to end it again.
export function isSubscriptionEnd(method: unknown, event: unknown): boolean {
  if (event === 'stop') {
    return true;
  }
  return method === WATCH_EVENT && typeof event === 'string' && TERMINAL_WATCH_EVENTS.has(event);
}

export function isRequestMessage(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && typeof value['method'] === 'string';
}

export function isResponseMessage(value: unknown): value is JsonRpcResponse {
  return isRecord(value) && 'id' in value && !('method' in value);
}

export function isSubscriptionMessage(value: unknown): value is SubscriptionMessage {
  return isRecord(value) && 'method' in value && isRecord(value['params']) && 'subscription' in value['params'];
}
