// One consumer's connection to a chain that holds several lanes. Requests go to the consumer's home lane, a follow goes
// to the lane picked for it, and a call on a follow's token goes to the lane that holds it.

import { type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';

import {
  type BrokerConnection,
  CHAIN_HEAD_FOLLOW,
  createJsonRpcError,
  getErrorMessage,
  isRequestMessage,
} from './brokerMessages';
import { type ChainBroker } from './createChainBroker';
import { runEvery } from './runEvery';

// What a lane's `connect` takes: the broker's own session params.
export type LaneConnectParams = Parameters<ChainBroker['connect']>[0];

// One lane as a consumer's router reaches it.
export type LaneHandle = {
  // Unique within its chain for the chain's life.
  readonly id: number;
  // Whether a session on this lane holds `localToken`. Never throws.
  hasToken(localToken: string): boolean;
  // Opens a session on this lane. Throws when `sessionId` names an open session of the lane.
  connect(params: LaneConnectParams): BrokerConnection;
};

type Params = LaneConnectParams & {
  // The consumer's home lane.
  home: LaneHandle;
  // The lane for a follow the consumer sends now: home while it has room, else another. Null when no lane with room can be
  // built. Never throws.
  pickFollowLane: () => LaneHandle | null;
  // The consumer's session id on a lane other than home, unique among every session of the chain.
  getLaneSessionId: (lane: LaneHandle) => string;
};

type LaneSession = {
  lane: LaneHandle;
  connection: BrokerConnection;
};

// Opens the consumer's session on `home` and routes what it sends across the chain's lanes. Throws what `home.connect`
// throws. The connection's `send` never throws, and its `disconnect` ends every session it opened, once, even past one
// that throws, then throws what they threw.
export function createLaneRouter({ home, pickFollowLane, getLaneSessionId, sessionId, onMessage }: Params): BrokerConnection {
  let disconnected = false;
  const homeConnection = home.connect({ sessionId, onMessage });
  // The sessions on lanes other than home, by lane id, kept until `disconnect`.
  const laneSessions = new Map<number, LaneSession>();

  // `message` is typed a request, which a consumer's code does not guarantee at runtime.
  function send(message: JsonRpcRequest): void {
    // Home's broker answers a message that is not one request, and drops one sent after `disconnect`.
    if (!isRequestMessage(message) || disconnected) {
      homeConnection.send(message);
      return;
    }
    if (message.method === CHAIN_HEAD_FOLLOW) {
      sendFollow(message);
      return;
    }
    (findTokenLane(message) ?? homeConnection).send(message);
  }

  function sendFollow(request: JsonRpcRequest): void {
    const lane = pickFollowLane();
    if (lane === null) {
      answerUnsent(request, `No lane can take a follow of ${sessionId}`);
      return;
    }
    if (lane.id === home.id) {
      homeConnection.send(request);
      return;
    }
    try {
      openLaneSession(lane).send(request);
    } catch (error) {
      answerUnsent(request, getErrorMessage(error));
    }
  }

  function openLaneSession(lane: LaneHandle): BrokerConnection {
    const open = laneSessions.get(lane.id);
    if (open) {
      return open.connection;
    }
    const connection = lane.connect({ sessionId: getLaneSessionId(lane), onMessage });
    laneSessions.set(lane.id, { lane, connection });
    return connection;
  }

  function findTokenLane(request: JsonRpcRequest): BrokerConnection | null {
    const localToken: unknown = Array.isArray(request.params) ? request.params[0] : undefined;
    if (typeof localToken !== 'string') {
      return null;
    }
    for (const { lane, connection } of laneSessions.values()) {
      if (lane.hasToken(localToken)) {
        return connection;
      }
    }
    return null;
  }

  function answerUnsent(request: JsonRpcRequest, message: string): void {
    onMessage(createJsonRpcError(request.id ?? null, message));
  }

  function disconnect(): void {
    if (disconnected) {
      return;
    }
    disconnected = true;
    try {
      runEvery(
        [
          () => {
            homeConnection.disconnect();
          },
          ...[...laneSessions.values()].map(({ connection }) => () => {
            connection.disconnect();
          }),
        ],
        `Lane router of ${sessionId}: ending every session failed`,
      );
    } finally {
      laneSessions.clear();
    }
  }

  return { send, disconnect };
}
