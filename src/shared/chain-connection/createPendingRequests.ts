import { type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';

import { type RequestOwner, type Session, RELEASE_METHODS, TOKEN_METHODS } from './brokerMessages';

type Params = {
  sendUpstream: (message: JsonRpcRequest) => void;
};

type TrackParams = {
  owner: RequestOwner;
  // Sent under a fresh broker id in place of its own.
  request: JsonRpcRequest;
};

// The requests the broker sent upstream and the owner of each, by the broker id they went out under.
export function createPendingRequests({ sendUpstream }: Params) {
  const pending = new Map<string, RequestOwner>();
  // Never reset, so a broker id is never reused.
  let requestCounter = 0;

  function track({ owner, request }: TrackParams): void {
    const upstreamId = `broker:${requestCounter.toString(36)}`;
    requestCounter += 1;
    pending.set(upstreamId, owner);
    sendUpstream({ ...request, id: upstreamId });
  }

  function take(id: string): RequestOwner | undefined {
    const owner = pending.get(id);
    pending.delete(id);
    return owner;
  }

  // Live, so a request tracked while it is read is read too.
  function listOwners(): IterableIterator<Readonly<RequestOwner>> {
    return pending.values();
  }

  function count(): number {
    return pending.size;
  }

  // Whether a release of `upstreamToken` is in flight, so the node may still send events it queued for it.
  function isReleasing(upstreamToken: string): boolean {
    return [...pending.values()].some(
      owner => owner.upstreamToken === upstreamToken && (owner.kind === 'release' || RELEASE_METHODS.has(owner.method)),
    );
  }

  // Whether a request in flight may open a subscription, whose events can come before its answer.
  function hasSubscriptionRequest(): boolean {
    return [...pending.values()].some(owner => TOKEN_METHODS.has(owner.method));
  }

  function orphanSession(session: Session): void {
    for (const [requestId, owner] of pending) {
      if (owner.kind === 'session' && owner.session === session) {
        pending.set(requestId, { kind: 'orphan', method: owner.method, upstreamToken: owner.upstreamToken });
      }
    }
  }

  function clear(): void {
    pending.clear();
  }

  return {
    track,
    take,
    listOwners,
    count,
    isReleasing,
    hasSubscriptionRequest,
    orphanSession,
    clear,
  };
}
