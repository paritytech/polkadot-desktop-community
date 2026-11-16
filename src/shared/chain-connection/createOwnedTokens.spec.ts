import { describe, expect, it } from 'vitest';

import { type Session, CHAIN_HEAD_UNFOLLOW } from './brokerMessages';
import { createOwnedTokens } from './createOwnedTokens';
import { noop } from './noop';

function createSession(id: string): Session {
  return { id, onMessage: noop };
}

describe('createOwnedTokens', () => {
  it('maps a local token per session and lists the owners of an upstream token', () => {
    const tokens = createOwnedTokens();
    const first = createSession('a');
    const second = createSession('b');

    const firstToken = tokens.mapToken({ session: first, upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });
    const secondToken = tokens.mapToken({ session: second, upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });

    expect(firstToken).not.toBe(secondToken);
    expect(tokens.find(firstToken)?.session).toBe(first);
    expect(tokens.find(secondToken)?.session).toBe(second);
    expect(tokens.listOwners('up1')).toHaveLength(2);
  });

  it('releases upstream only with its last owner', () => {
    const tokens = createOwnedTokens();
    const firstToken = tokens.mapToken({
      session: createSession('a'),
      upstreamToken: 'up1',
      releaseMethod: CHAIN_HEAD_UNFOLLOW,
    });
    const secondToken = tokens.mapToken({
      session: createSession('b'),
      upstreamToken: 'up1',
      releaseMethod: CHAIN_HEAD_UNFOLLOW,
    });

    expect(tokens.release(firstToken)).toBe(false);
    expect(tokens.release(secondToken)).toBe(true);
  });

  it('counts each upstream subscription once per release method', () => {
    const tokens = createOwnedTokens();
    tokens.mapToken({ session: createSession('a'), upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });
    tokens.mapToken({ session: createSession('b'), upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });
    tokens.mapToken({ session: createSession('c'), upstreamToken: 'up2', releaseMethod: CHAIN_HEAD_UNFOLLOW });

    expect(tokens.countUpstream(CHAIN_HEAD_UNFOLLOW)).toBe(2);
  });

  it('never reuses a local token after clear', () => {
    const tokens = createOwnedTokens();
    const session = createSession('a');
    const before = tokens.mapToken({ session, upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });

    tokens.clear();
    const after = tokens.mapToken({ session, upstreamToken: 'up1', releaseMethod: CHAIN_HEAD_UNFOLLOW });

    expect(after).not.toBe(before);
  });
});
