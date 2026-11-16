import { type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { describe, expect, it } from 'vitest';

import { type LaneConnectParams, type LaneHandle, createLaneRouter } from './createLaneRouter';

type FakeSession = {
  params: LaneConnectParams;
  sent: JsonRpcRequest[];
  disconnects: number;
};

type FakeLaneParams = {
  id: number;
  // The local tokens a session on this lane holds.
  tokens?: string[];
  // Thrown by `connect`, as a lane that refuses a session does.
  refusal?: Error;
  // Thrown by a session's `disconnect` after it counted, as a lane whose close fails does.
  disconnectFailure?: unknown;
};

function createFakeLane({ id, tokens = [], refusal, disconnectFailure }: FakeLaneParams): {
  lane: LaneHandle;
  sessions: FakeSession[];
} {
  const sessions: FakeSession[] = [];
  const lane: LaneHandle = {
    id,
    hasToken: localToken => tokens.includes(localToken),
    connect(params) {
      if (refusal) {
        throw refusal;
      }
      const session: FakeSession = { params, sent: [], disconnects: 0 };
      sessions.push(session);
      return {
        send(message) {
          session.sent.push(message);
        },
        disconnect() {
          session.disconnects += 1;
          if (disconnectFailure !== undefined) {
            throw disconnectFailure;
          }
        },
      };
    },
  };
  return { lane, sessions };
}

function createFollow(id: number): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: 'chainHead_v1_follow', params: [true] };
}

function getLaneSessionId(lane: LaneHandle): string {
  return `consumer-1@${String(lane.id)}`;
}

describe('createLaneRouter', () => {
  it('sends a follow to the picked lane under the session id given for that lane', () => {
    // Given a home lane with no room and an overflow lane
    const home = createFakeLane({ id: 1 });
    const overflow = createFakeLane({ id: 2 });
    const onMessage = (): void => undefined;
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });

    // When it follows twice
    router.send(createFollow(1));
    router.send(createFollow(2));

    // Then both follows reach one session on the overflow lane, under its own id, and none reaches home
    expect(overflow.sessions.map(s => [s.params.sessionId, s.params.onMessage])).toEqual([['consumer-1@2', onMessage]]);
    expect(overflow.sessions[0]?.sent).toEqual([createFollow(1), createFollow(2)]);
    expect(home.sessions[0]?.sent).toEqual([]);
  });

  it('sends a follow to the picked lane and its calls after it', () => {
    // Given a follow that went to the overflow lane, which holds its token
    const home = createFakeLane({ id: 1 });
    const overflow = createFakeLane({ id: 2, tokens: ['follow-2'] });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });
    router.send(createFollow(1));
    const storage: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'chainHead_v1_storage',
      params: ['follow-2', '0xabc', []],
    };

    // When it calls on that token
    router.send(storage);

    // Then the call follows its follow
    expect(overflow.sessions[0]?.sent).toEqual([createFollow(1), storage]);
    expect(home.sessions[0]?.sent).toEqual([]);
  });

  it('sends a request with no token home', () => {
    // Given a follow that went to the overflow lane, which holds its token
    const home = createFakeLane({ id: 1 });
    const overflow = createFakeLane({ id: 2, tokens: ['follow-2'] });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });
    router.send(createFollow(1));
    const other: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'chainHead_v1_storage',
      params: ['follow-1', '0xabc', []],
    };
    const untokened: JsonRpcRequest = { jsonrpc: '2.0', id: 4, method: 'chainSpec_v1_genesisHash', params: [] };
    const unparamed: JsonRpcRequest = { jsonrpc: '2.0', id: 5, method: 'system_name' };

    // When it calls on a token the overflow lane does not hold, and sends requests without a token
    router.send(other);
    router.send(untokened);
    router.send(unparamed);

    // Then each goes home
    expect(home.sessions[0]?.sent).toEqual([other, untokened, unparamed]);
    expect(overflow.sessions[0]?.sent).toEqual([createFollow(1)]);
  });

  it('sends a message that is not one request home as it came', () => {
    // Given a router on its home lane
    const home = createFakeLane({ id: 1 });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => home.lane,
      getLaneSessionId,
    });
    const batch = [createFollow(1)];
    const methodless = { jsonrpc: '2.0', id: 2 };

    // When it sends a batch and a value without a method
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a batch is the malformed input under test, which `send` does not type
    router.send(batch as unknown as JsonRpcRequest);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a value without a method is the malformed input under test, which `send` does not type
    router.send(methodless as unknown as JsonRpcRequest);

    // Then home hears both as they came
    expect(home.sessions[0]?.sent).toEqual([batch, methodless]);
  });

  it('answers a follow whose lane refuses the session with an error, and nothing throws', () => {
    // Given an overflow lane that refuses the session
    const home = createFakeLane({ id: 1 });
    const overflow = createFakeLane({ id: 2, refusal: new Error('Duplicate broker session: consumer-1@2') });
    const heard: JsonRpcMessage[] = [];
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: message => {
        heard.push(message);
      },
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });

    // When it follows
    expect(() => {
      router.send(createFollow(7));
    }).not.toThrow();

    // Then it hears the refusal under its follow's id, and home hears nothing
    expect(heard).toEqual([
      { jsonrpc: '2.0', id: 7, error: { code: -32603, message: 'Duplicate broker session: consumer-1@2' } },
    ]);
    expect(home.sessions[0]?.sent).toEqual([]);
  });

  it('answers a follow no lane can take with an error', () => {
    // Given a chain with no lane that has room
    const home = createFakeLane({ id: 1 });
    const heard: JsonRpcMessage[] = [];
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: message => {
        heard.push(message);
      },
      home: home.lane,
      pickFollowLane: () => null,
      getLaneSessionId,
    });

    // When it follows
    router.send(createFollow(4));

    // Then it hears the error under its follow's id, and nothing is sent
    expect(heard).toEqual([
      { jsonrpc: '2.0', id: 4, error: { code: -32603, message: 'No lane can take a follow of consumer-1' } },
    ]);
    expect(home.sessions[0]?.sent).toEqual([]);
  });

  it('ends every session it opened on disconnect, once', () => {
    // Given sessions on home and on an overflow lane
    const home = createFakeLane({ id: 1 });
    const overflow = createFakeLane({ id: 2 });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });
    router.send(createFollow(1));

    // When it disconnects twice
    router.disconnect();
    router.disconnect();

    // Then each session ended once
    expect([...home.sessions, ...overflow.sessions].map(s => s.disconnects)).toEqual([1, 1]);
  });

  it('throws the home failure on disconnect and still ends the session on another lane', () => {
    // Given sessions on a home lane whose close fails and on an overflow lane
    const failure = new Error('home lane close failed');
    const home = createFakeLane({ id: 1, disconnectFailure: failure });
    const overflow = createFakeLane({ id: 2 });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });
    router.send(createFollow(1));

    // When it disconnects
    // Then it throws home's failure, and the overflow session ended too
    expect(() => {
      router.disconnect();
    }).toThrow(failure);
    expect(overflow.sessions.map(s => s.disconnects)).toEqual([1]);
  });

  it('throws an AggregateError when two sessions fail to end', () => {
    // Given sessions on two lanes whose closes both fail
    const homeFailure = new Error('home lane close failed');
    const overflowFailure = new Error('overflow lane close failed');
    const home = createFakeLane({ id: 1, disconnectFailure: homeFailure });
    const overflow = createFakeLane({ id: 2, disconnectFailure: overflowFailure });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => overflow.lane,
      getLaneSessionId,
    });
    router.send(createFollow(1));

    // When it disconnects
    // Then it throws both failures in one AggregateError, after each session ended
    expect(() => {
      router.disconnect();
    }).toThrow(
      expect.objectContaining({
        name: 'AggregateError',
        message: 'Lane router of consumer-1: ending every session failed',
        errors: [homeFailure, overflowFailure],
      }),
    );
    expect([...home.sessions, ...overflow.sessions].map(s => s.disconnects)).toEqual([1, 1]);
  });

  it('wraps a lone non-Error throw in an AggregateError', () => {
    // Given a home lane whose close throws a string
    const home = createFakeLane({ id: 1, disconnectFailure: 'home lane close failed' });
    const router = createLaneRouter({
      sessionId: 'consumer-1',
      onMessage: () => undefined,
      home: home.lane,
      pickFollowLane: () => home.lane,
      getLaneSessionId,
    });

    // When it disconnects
    // Then it throws the string inside an AggregateError
    expect(() => {
      router.disconnect();
    }).toThrow(
      expect.objectContaining({
        name: 'AggregateError',
        message: 'Lane router of consumer-1: ending every session failed',
        errors: ['home lane close failed'],
      }),
    );
  });
});
