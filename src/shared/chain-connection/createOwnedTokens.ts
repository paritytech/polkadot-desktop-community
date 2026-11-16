import { type OwnedToken, type Session } from './brokerMessages';

type MapTokenParams = {
  session: Session;
  upstreamToken: string;
  // Ends the subscription upstream once its last owner releases it.
  releaseMethod: string;
};

// The upstream subscriptions sessions own, such as follows, transaction watches and statement subscriptions, each under a
// local token of its own. Several sessions can own one upstream subscription, which ends upstream with its last owner.
export function createOwnedTokens() {
  const localToOwned = new Map<string, OwnedToken>();
  const upstreamToOwned = new Map<string, Set<OwnedToken>>();
  // Never reset, so no two local tokens of the broker's life are the same.
  let tokenCounter = 0;

  function mapToken({ session, upstreamToken, releaseMethod }: MapTokenParams): string {
    const localToken = `token:${tokenCounter.toString(36)}:${session.id}`;
    tokenCounter += 1;
    const owned: OwnedToken = { session, localToken, upstreamToken, releaseMethod };
    localToOwned.set(localToken, owned);
    let owners = upstreamToOwned.get(upstreamToken);
    if (owners === undefined) {
      owners = new Set<OwnedToken>();
      upstreamToOwned.set(upstreamToken, owners);
    }
    owners.add(owned);
    return localToken;
  }

  function find(localToken: string): Readonly<OwnedToken> | undefined {
    return localToOwned.get(localToken);
  }

  function has(localToken: string): boolean {
    return localToOwned.has(localToken);
  }

  function listOwners(upstreamToken: string): Readonly<OwnedToken>[] {
    return [...(upstreamToOwned.get(upstreamToken) ?? [])];
  }

  function listSessionTokens(session: Session): Readonly<OwnedToken>[] {
    return [...localToOwned.values()].filter(owned => owned.session === session);
  }

  function countUpstream(releaseMethod: string): number {
    let count = 0;
    for (const owners of upstreamToOwned.values()) {
      const [first] = owners;
      if (first?.releaseMethod === releaseMethod) {
        count += 1;
      }
    }
    return count;
  }

  // Returns whether `localToken` was the last owner of its upstream subscription, which the caller then ends upstream.
  function release(localToken: string): boolean {
    const owned = localToOwned.get(localToken);
    if (owned === undefined) {
      return false;
    }
    localToOwned.delete(localToken);
    const owners = upstreamToOwned.get(owned.upstreamToken);
    owners?.delete(owned);
    if ((owners?.size ?? 0) > 0) {
      return false;
    }
    upstreamToOwned.delete(owned.upstreamToken);
    return true;
  }

  function clear(): void {
    localToOwned.clear();
    upstreamToOwned.clear();
  }

  return {
    mapToken,
    find,
    has,
    listOwners,
    listSessionTokens,
    countUpstream,
    release,
    clear,
  };
}
