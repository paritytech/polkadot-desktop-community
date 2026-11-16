// The lanes of one chain: several connections to it, each with its own broker, opened and closed so each stays under
// the chain's follow limit. Lane 0 lives as long as the lanes. Another lane opens when no lane has room and closes once
// no session is on it.

import { type BrokerConnection, getErrorMessage } from './brokerMessages';
import { type BrokerWarner } from './createBrokerWarner';
import { type ChainBroker, createChainBroker } from './createChainBroker';
import { type LaneConnectParams, type LaneHandle, createLaneRouter } from './createLaneRouter';
import { type RestartableJsonRpcProvider } from './createRestartableProvider';
import { runEvery } from './runEvery';
import { type ConnectionStatus } from './types';

export type ChainLanes = ReturnType<typeof createChainLanes>;

type ChainLanesParams = {
  // Names the chain in logs.
  label: string;
  // Builds one lane's transport. Called once per lane.
  createTransport: (onStatus: (status: ConnectionStatus) => void) => RestartableJsonRpcProvider;
  // The most follows one connection may hold now. Read at every lane pick.
  followLimit: () => number;
  // Shared by every lane's broker, so the chain keeps one warning count.
  warn: BrokerWarner;
  // Whether the pool is paused as the lanes are built.
  paused: boolean;
  // Hears each change of the combined status.
  onStatus: (status: ConnectionStatus) => void;
};

// Whether a session is a consumer's own, on its home lane, or one the consumer's router opened for a follow.
type SessionRole = 'home' | 'follow';

type Lane = {
  // Unique among the chain's lanes for the chain's life.
  readonly id: number;
  readonly transport: RestartableJsonRpcProvider;
  readonly broker: ChainBroker;
  // Every open session on the lane, by session id.
  readonly sessions: Map<string, SessionRole>;
  status: ConnectionStatus;
};

// Builds lane 0 at once.
export function createChainLanes({
  label,
  createTransport,
  followLimit,
  warn,
  paused: initiallyPaused,
  onStatus,
}: ChainLanesParams) {
  // In id order, the open lanes only, so a lane missing from it is closed.
  const lanes: Lane[] = [];
  let nextLaneId = 0;
  let nextSessionNumber = 0;
  let paused = initiallyPaused;
  let closed = false;

  lanes.push(buildLane());
  let reported = getStatus();

  // Builds a lane under the next id. Throws what `createTransport` throws.
  function buildLane(): Lane {
    const id = nextLaneId;
    nextLaneId += 1;
    const transport = createTransport(status => {
      const lane = findLane(id);
      if (lane === undefined) {
        return;
      }
      lane.status = status;
      reportStatus();
    });
    // Before the broker opens the transport, so a lane built while paused never opens a connection.
    if (paused) {
      transport.pause();
    }
    return {
      id,
      transport,
      broker: createChainBroker({ provider: transport, warn }),
      sessions: new Map(),
      // A paused transport reports nothing until it resumes.
      status: paused ? 'disconnected' : 'connecting',
    };
  }

  function addLane(): Lane {
    const lane = buildLane();
    lanes.push(lane);
    reportStatus();
    return lane;
  }

  function findLane(id: number): Lane | undefined {
    return lanes.find(lane => lane.id === id);
  }

  function hasRoom(lane: Lane): boolean {
    return lane.broker.countFollows() < followLimit();
  }

  function countHomes(lane: Lane): number {
    let homes = 0;
    for (const role of lane.sessions.values()) {
      if (role === 'home') {
        homes += 1;
      }
    }
    return homes;
  }

  function hasConsumer(sessionId: string): boolean {
    return lanes.some(lane => lane.sessions.get(sessionId) === 'home');
  }

  // Among the lanes with room, the one with the fewest consumers at home, the lowest id on a tie, else a new lane.
  function pickHomeLane(): Lane {
    let picked: Lane | null = null;
    for (const lane of lanes) {
      if (hasRoom(lane) && (picked === null || countHomes(lane) < countHomes(picked))) {
        picked = lane;
      }
    }
    return picked ?? addLane();
  }

  function pickFollowLane(home: Lane): LaneHandle | null {
    // A consumer whose home lane closed has no session left to follow for.
    if (!lanes.includes(home)) {
      return null;
    }
    const roomy = hasRoom(home) ? home : lanes.find(hasRoom);
    try {
      return createHandle(roomy ?? addLane(), 'follow');
    } catch {
      // A lane that cannot be built leaves no lane for the follow, which the router answers with an error.
      return null;
    }
  }

  function getLaneSessionId(lane: LaneHandle): string {
    const sessionId = `lane:${String(lane.id)}:${String(nextSessionNumber)}`;
    nextSessionNumber += 1;
    return sessionId;
  }

  function createHandle(lane: Lane, role: SessionRole): LaneHandle {
    return {
      id: lane.id,
      hasToken: lane.broker.hasToken,
      connect: params => connectSession(lane, params, role),
    };
  }

  // Opens a session on the lane and counts it there until it ends, closing an extra lane its end leaves empty. A session
  // that cannot open closes the lane built for it.
  function connectSession(lane: Lane, params: LaneConnectParams, role: SessionRole): BrokerConnection {
    let connection: BrokerConnection;
    try {
      connection = lane.broker.connect(params);
    } catch (error) {
      closeIfEmpty(lane);
      throw error;
    }
    const { sessionId } = params;
    lane.sessions.set(sessionId, role);
    let open = true;
    return {
      send: connection.send,
      disconnect() {
        if (!open) {
          return;
        }
        open = false;
        lane.sessions.delete(sessionId);
        try {
          connection.disconnect();
        } finally {
          closeIfEmpty(lane);
        }
      },
    };
  }

  // Closes an extra lane with no session left. A failed close is warned, never thrown, as the lane is gone either way.
  function closeIfEmpty(lane: Lane): void {
    if (lane.id === 0 || lane.sessions.size > 0 || !lanes.includes(lane)) {
      return;
    }
    lanes.splice(lanes.indexOf(lane), 1);
    try {
      lane.broker.disconnectAll();
    } catch (error) {
      warn('lane_close_failed', `closing ${label} lane ${String(lane.id)} once empty failed: ${getErrorMessage(error)}`);
    }
    reportStatus();
  }

  // `connected` when every open lane is, `disconnected` when any is or none is open, `connecting` otherwise.
  function getStatus(): ConnectionStatus {
    if (lanes.length === 0 || lanes.some(lane => lane.status === 'disconnected')) {
      return 'disconnected';
    }
    return lanes.every(lane => lane.status === 'connected') ? 'connected' : 'connecting';
  }

  function reportStatus(): void {
    const status = getStatus();
    if (status === reported) {
      return;
    }
    reported = status;
    onStatus(status);
  }

  // Calls `step` on every open lane's transport, even past one that throws, then throws what they threw.
  function runOnEveryTransport(step: (transport: RestartableJsonRpcProvider) => void, action: string): void {
    runEvery(
      lanes.map(lane => () => {
        step(lane.transport);
      }),
      `${label} lanes: ${action} every lane failed`,
    );
  }

  // A consumer's connection, which sends its requests on its home lane and each follow on a lane with room. Throws when
  // `sessionId` names an open consumer, after `disconnectAll`, or what a new home lane throws as it is built or as its
  // first session opens.
  function connect(params: LaneConnectParams): BrokerConnection {
    if (closed) {
      throw new Error(`${label} closed, so ${params.sessionId} cannot connect`);
    }
    if (hasConsumer(params.sessionId)) {
      throw new Error(`Duplicate ${label} consumer: ${params.sessionId}`);
    }
    const home = pickHomeLane();
    return createLaneRouter({
      ...params,
      home: createHandle(home, 'home'),
      pickFollowLane: () => pickFollowLane(home),
      getLaneSessionId,
    });
  }

  // Leaves every lane's status to its transport, which a transport that cannot pause keeps reporting as it was.
  function pause(): void {
    paused = true;
    runOnEveryTransport(transport => {
      transport.pause();
    }, 'pausing');
  }

  function resume(): void {
    if (!paused) {
      return;
    }
    paused = false;
    runOnEveryTransport(transport => {
      transport.resume();
    }, 'resuming');
  }

  // Each transport keeps its paused state across its restart.
  function restart(): void {
    runOnEveryTransport(transport => {
      transport.restart();
    }, 'restarting');
  }

  // Ends every lane's sessions and closes its connection, lane 0 included. The lanes stay closed, so a later `connect`
  // throws.
  function disconnectAll(): void {
    closed = true;
    const closing = lanes.splice(0);
    try {
      runEvery(
        closing.map(lane => () => {
          lane.broker.disconnectAll();
        }),
        `${label} lanes: closing every lane failed`,
      );
    } finally {
      reportStatus();
    }
  }

  return {
    connect,
    // The combined status of the open lanes. Never throws.
    status: getStatus,
    // `pause`, `resume` and `restart` try every open lane's transport, then throw what any threw: the one `Error`, or an
    // AggregateError otherwise. `resume` while not paused does nothing.
    pause,
    resume,
    restart,
    // Tries every lane, then throws as `pause` does.
    disconnectAll,
  };
}
