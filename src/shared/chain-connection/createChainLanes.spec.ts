import { type JsonRpcConnection, type JsonRpcMessage, type JsonRpcRequest } from '@polkadot-api/json-rpc-provider';
import { describe, expect, it, vi } from 'vitest';

import { type BrokerConnection, CHAIN_HEAD_FOLLOW, CHAIN_HEAD_UNFOLLOW, isRecord } from './brokerMessages';
import { type ChainLanes, createChainLanes } from './createChainLanes';
import { type RestartableJsonRpcProvider } from './createRestartableProvider';
import { type ConnectionStatus } from './types';

// What goes wrong with one transport: its build throws, its opening throws, its close throws, or its pause throws.
type TransportFault = 'build' | 'open' | 'disconnect' | 'pause';

type TransportRecord = {
  // Reports a status as the lane's transport.
  onStatus: (status: ConnectionStatus) => void;
  // What the lane sent the node, in order.
  sent: JsonRpcRequest[];
  // What the lane did to its transport, in order: `open`, `disconnect`, `pause`, `resume` and `restart`.
  calls: string[];
  // Answers, as the node, every request of `method` not answered yet, each with a fresh result.
  answer: (method: string) => void;
  // Delivers a message from the node.
  emit: (message: JsonRpcMessage) => void;
};

type TransportsParams = {
  // The fault of each transport the factory is asked for, by call from 0.
  faults?: Partial<Record<number, TransportFault>>;
};

type LanesParams = {
  createTransport: (onStatus: (status: ConnectionStatus) => void) => RestartableJsonRpcProvider;
  followLimit?: () => number;
  paused?: boolean;
  warn?: (kind: string, message: string) => void;
};

type Consumer = {
  connection: BrokerConnection;
  heard: unknown[];
};

const RPC_FOLLOW_LIMIT = 4;
const FAULT = new Error('transport fault');

// A factory of fake restartable providers that records what each lane does to its transport, and lets a test answer as
// the node.
function createTransports({ faults = {} }: TransportsParams = {}) {
  const built: TransportRecord[] = [];
  let calls = 0;
  let nextResult = 0;

  function createTransport(onStatus: (status: ConnectionStatus) => void): RestartableJsonRpcProvider {
    const fault = faults[calls];
    calls += 1;
    if (fault === 'build') {
      throw FAULT;
    }
    let listener: ((message: JsonRpcMessage) => void) | null = null;
    const answered = new Set<JsonRpcRequest>();
    const record: TransportRecord = {
      onStatus,
      sent: [],
      calls: [],
      answer(method) {
        for (const request of listSent(record, method)) {
          if (answered.has(request) || request.id === undefined) {
            continue;
          }
          answered.add(request);
          listener?.({ jsonrpc: '2.0', id: request.id, result: `${method}-${String(nextResult)}` });
          nextResult += 1;
        }
      },
      emit(message) {
        listener?.(message);
      },
    };
    built.push(record);

    function provider(onMessage: (message: JsonRpcMessage) => void): JsonRpcConnection {
      if (fault === 'open') {
        throw FAULT;
      }
      listener = onMessage;
      record.calls.push('open');
      return {
        send(message) {
          record.sent.push(message);
        },
        disconnect() {
          record.calls.push('disconnect');
          if (fault === 'disconnect') {
            throw FAULT;
          }
        },
      };
    }

    return Object.assign(provider, {
      pause() {
        record.calls.push('pause');
        if (fault === 'pause') {
          throw FAULT;
        }
      },
      resume() {
        record.calls.push('resume');
      },
      restart() {
        record.calls.push('restart');
      },
    });
  }

  return { createTransport, built };
}

// Builds a chain's lanes that record each combined status.
function createLanes({
  createTransport,
  followLimit = () => RPC_FOLLOW_LIMIT,
  paused = false,
  warn = () => undefined,
}: LanesParams): { lanes: ChainLanes; statuses: ConnectionStatus[] } {
  const statuses: ConnectionStatus[] = [];
  const lanes = createChainLanes({
    label: 'test-chain',
    createTransport,
    followLimit,
    warn,
    paused,
    onStatus: status => {
      statuses.push(status);
    },
  });
  return { lanes, statuses };
}

function connectConsumer(lanes: ChainLanes, sessionId: string): Consumer {
  const heard: unknown[] = [];
  const connection = lanes.connect({
    sessionId,
    onMessage: message => {
      heard.push(message);
    },
  });
  return { connection, heard };
}

// Connects `local:a` to `local:d`, and each follows once, so lane 0 holds as many follows as an RPC node takes.
function fillLaneZero(lanes: ChainLanes): [Consumer, ...Consumer[]] {
  const [first, ...rest] = ['a', 'b', 'c', 'd'].map(name => connectConsumer(lanes, `local:${name}`));
  expect(first).toBeDefined();
  if (first === undefined) {
    throw new Error('No first consumer');
  }
  const consumers: [Consumer, ...Consumer[]] = [first, ...rest];
  for (const consumer of consumers) {
    consumer.connection.send(createFollow(1));
  }
  return consumers;
}

function createFollow(id: number): JsonRpcRequest {
  return { jsonrpc: '2.0', id, method: CHAIN_HEAD_FOLLOW, params: [true] };
}

function listSent(record: TransportRecord, method: string): JsonRpcRequest[] {
  return record.sent.filter(message => message.method === method);
}

// The transport the factory built `index`-th, failing the test when there is none.
function nth(built: TransportRecord[], index: number): TransportRecord {
  const record = built[index];
  expect(record).toBeDefined();
  if (record === undefined) {
    throw new Error(`No transport ${String(index)}`);
  }
  return record;
}

// The answer the consumer heard to its request `id`, failing the test when there is none.
function readAnswer(consumer: Consumer, id: number): Record<string, unknown> {
  const answer = consumer.heard.find(message => isRecord(message) && message['id'] === id);
  expect(answer).toBeDefined();
  if (!isRecord(answer)) {
    throw new Error(`No answer to ${String(id)}`);
  }
  return answer;
}

describe('createChainLanes', () => {
  it.each([
    { chain: 'a chain with no follow limit', followLimit: Infinity, perLane: [5] },
    { chain: 'an RPC chain', followLimit: RPC_FOLLOW_LIMIT, perLane: [4, 1] },
  ])('As $chain, I spread five follows over my lanes as $perLane', ({ followLimit, perLane }) => {
    // Given lanes with this follow limit, and five consumers
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, followLimit: () => followLimit });
    const consumers = ['a', 'b', 'c', 'd', 'e'].map(name => connectConsumer(lanes, `local:${name}`));

    // When each follows
    for (const consumer of consumers) {
      consumer.connection.send(createFollow(1));
    }

    // Then each lane sends its share of the five follows
    expect(built.map(record => listSent(record, CHAIN_HEAD_FOLLOW).length)).toEqual(perLane);
  });

  it('As an RPC chain, I send two follows together into a lane with one slot left and only the first takes it', () => {
    // Given lane 0 with three follows, and a fourth consumer
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    for (const name of ['a', 'b', 'c']) {
      connectConsumer(lanes, `local:${name}`).connection.send(createFollow(1));
    }
    const consumer = connectConsumer(lanes, 'local:d');

    // When the fourth consumer sends two follows back to back
    consumer.connection.send(createFollow(1));
    consumer.connection.send(createFollow(2));

    // Then the first takes lane 0's last slot and the second goes out on a new lane
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(4);
    expect(listSent(nth(built, 1), CHAIN_HEAD_FOLLOW)).toHaveLength(1);
  });

  it('As an RPC chain, I count an unfollow in flight, so a consumer that follows again at once goes to another lane', () => {
    // Given lane 0 full of answered follows
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const [consumer] = fillLaneZero(lanes);
    nth(built, 0).answer(CHAIN_HEAD_FOLLOW);
    const token = readAnswer(consumer, 1)['result'];

    // When one consumer unfollows and, before the node answers, follows again
    consumer.connection.send({ jsonrpc: '2.0', id: 2, method: CHAIN_HEAD_UNFOLLOW, params: [token] });
    consumer.connection.send(createFollow(3));

    // Then the unfollow goes out on lane 0 and the new follow on a new lane
    expect(listSent(nth(built, 0), CHAIN_HEAD_UNFOLLOW)).toHaveLength(1);
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(4);
    expect(listSent(nth(built, 1), CHAIN_HEAD_FOLLOW)).toHaveLength(1);
  });

  it('As an RPC chain, I give a new consumer the lane with room and the fewest consumers at home', () => {
    // Given lane 0 full, a consumer homed on lane 1 as it opened, and then a consumer of lane 0 gone with its unfollow
    // answered, so lane 0 has room for one follow and three consumers at home
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const [first] = fillLaneZero(lanes);
    nth(built, 0).answer(CHAIN_HEAD_FOLLOW);
    connectConsumer(lanes, 'local:e');
    first.connection.disconnect();
    nth(built, 0).answer(CHAIN_HEAD_UNFOLLOW);

    // When a new consumer connects and asks for the genesis hash
    const consumer = connectConsumer(lanes, 'local:f');
    consumer.connection.send({ jsonrpc: '2.0', id: 1, method: 'chainSpec_v1_genesisHash', params: [] });

    // Then the request goes out on lane 1, which has room and one consumer at home
    expect(nth(built, 1).sent.map(message => message.method)).toEqual(['chainSpec_v1_genesisHash']);
  });

  it('As an RPC chain, I send a consumer homed on a lane with room its follow there before a lower lane with room', () => {
    // Given lane 0 full, a consumer homed on lane 1, and then lane 0 with one slot free
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const [first] = fillLaneZero(lanes);
    nth(built, 0).answer(CHAIN_HEAD_FOLLOW);
    const extra = connectConsumer(lanes, 'local:e');
    first.connection.disconnect();
    nth(built, 0).answer(CHAIN_HEAD_UNFOLLOW);

    // When the consumer homed on lane 1 follows
    extra.connection.send(createFollow(1));

    // Then the follow goes out on lane 1, and lane 0 keeps its free slot
    expect(listSent(nth(built, 1), CHAIN_HEAD_FOLLOW)).toHaveLength(1);
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(4);
  });

  it('As an RPC chain, I close an extra lane when its last consumer leaves, and keep lane 0', () => {
    // Given lane 0 full, and a consumer homed on lane 1
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const consumers = fillLaneZero(lanes);
    const extra = connectConsumer(lanes, 'local:e');

    // When every consumer leaves
    extra.connection.disconnect();
    for (const consumer of consumers) {
      consumer.connection.disconnect();
    }

    // Then lane 1's connection is closed and lane 0's stays open
    expect(nth(built, 1).calls).toEqual(['open', 'disconnect']);
    expect(nth(built, 0).calls).toEqual(['open']);
  });

  it('As an RPC chain, I never give a new lane the id of a closed one', () => {
    // Given lane 0 full of answered follows, and lane 1 opened and closed again
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const [consumer] = fillLaneZero(lanes);
    nth(built, 0).answer(CHAIN_HEAD_FOLLOW);
    connectConsumer(lanes, 'local:e').connection.disconnect();

    // When a consumer follows again, and the node answers on the lane opened for it
    consumer.connection.send(createFollow(2));
    nth(built, 2).answer(CHAIN_HEAD_FOLLOW);

    // Then the follow's token names lane 2
    expect(readAnswer(consumer, 2)['result']).toEqual(expect.stringContaining(':lane:2:'));
  });

  it('As an RPC chain, I read connecting while a new lane opens, and connected once every lane is', () => {
    // Given lane 0 connected and full
    const { createTransport, built } = createTransports();
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);

    // When a consumer opens lane 1, and lane 1 connects
    connectConsumer(lanes, 'local:e');
    const opening = lanes.status();
    nth(built, 1).onStatus('connected');

    // Then the chain reads connecting while lane 1 opens, and connected after
    expect(opening).toBe('connecting');
    expect(statuses).toEqual(['connected', 'connecting', 'connected']);
    expect(lanes.status()).toBe('connected');
  });

  it('As an RPC chain, I ignore a status from a lane I closed', () => {
    // Given lane 0 connected and full, and lane 1 connected and then closed as its consumer left
    const { createTransport, built } = createTransports();
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);
    const extra = connectConsumer(lanes, 'local:e');
    nth(built, 1).onStatus('connected');
    extra.connection.disconnect();

    // When the closed lane reports a disconnect
    nth(built, 1).onStatus('disconnected');

    // Then the chain stays connected
    expect(lanes.status()).toBe('connected');
    expect(statuses).toEqual(['connected', 'connecting', 'connected']);
  });

  it('As an RPC chain, I answer a follow with an error when its new lane cannot be built', () => {
    // Given lane 0 full, and a second lane whose build throws
    const { createTransport, built } = createTransports({ faults: { 1: 'build' } });
    const { lanes } = createLanes({ createTransport });
    const [consumer] = fillLaneZero(lanes);

    // When a consumer follows again
    consumer.connection.send(createFollow(2));

    // Then the follow is answered with an error, and only lane 0 was built
    expect(readAnswer(consumer, 2)).toHaveProperty('error');
    expect(built).toHaveLength(1);
  });

  it('As an RPC chain, I answer a follow whose session cannot open on a new lane with an error, and leave no lane', () => {
    // Given lane 0 connected and full, and a second lane whose connection throws on opening
    const { createTransport, built } = createTransports({ faults: { 1: 'open' } });
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    const [consumer] = fillLaneZero(lanes);

    // When a consumer follows again
    consumer.connection.send(createFollow(2));

    // Then the follow is answered with an error, and the chain reads connected again, with no lane left opening
    expect(readAnswer(consumer, 2)).toHaveProperty('error');
    expect(statuses).toEqual(['connected', 'connecting', 'connected']);
    expect(lanes.status()).toBe('connected');
  });

  it("As an RPC chain, I pause every lane when one lane's pause throws, and throw its error", () => {
    // Given lane 0 whose pause throws, and lane 1 open
    const { createTransport, built } = createTransports({ faults: { 0: 'pause' } });
    const { lanes } = createLanes({ createTransport });
    fillLaneZero(lanes);
    connectConsumer(lanes, 'local:e');

    // When the chain pauses, then lane 0's error is thrown, and lane 1 is paused too
    expect(() => {
      lanes.pause();
    }).toThrow(FAULT);
    expect(nth(built, 1).calls).toContain('pause');
  });

  it("As an RPC chain, I close every lane when one lane's close throws, and throw its error", () => {
    // Given lane 0 whose close throws, and lane 1 open
    const { createTransport, built } = createTransports({ faults: { 0: 'disconnect' } });
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);
    connectConsumer(lanes, 'local:e');

    // When the chain closes, then lane 0's error is thrown
    expect(() => {
      lanes.disconnectAll();
    }).toThrow(FAULT);

    // And lane 1 closes too, and the last status heard is disconnected
    expect(nth(built, 1).calls).toContain('disconnect');
    expect(statuses.at(-1)).toBe('disconnected');
  });

  it('As an RPC chain, I warn when closing an empty extra lane throws, and still close it', () => {
    // Given lane 0 connected and full, and a consumer homed on lane 1, whose close throws
    const warn = vi.fn<(kind: string, message: string) => void>();
    const { createTransport, built } = createTransports({ faults: { 1: 'disconnect' } });
    const { lanes, statuses } = createLanes({ createTransport, warn });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);
    const extra = connectConsumer(lanes, 'local:e');

    // When that consumer leaves
    extra.connection.disconnect();

    // Then the close's failure is warned, and the chain reads lane 0's status alone
    expect(warn).toHaveBeenCalledWith('lane_close_failed', expect.stringContaining(FAULT.message));
    expect(statuses).toEqual(['connected', 'connecting', 'connected']);
  });

  it('As an RPC chain, I throw the build error when a new home lane cannot be built, and leave no lane', () => {
    // Given lane 0 connected and full, and a second lane whose build throws
    const { createTransport, built } = createTransports({ faults: { 1: 'build' } });
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);

    // When a new consumer connects, then the connect throws the build's error
    expect(() => connectConsumer(lanes, 'local:e')).toThrow(FAULT);

    // And only lane 0 was built, and the status is unchanged
    expect(built).toHaveLength(1);
    expect(lanes.status()).toBe('connected');
    expect(statuses).toEqual(['connected']);
  });

  it('As an RPC chain, I drop a new lane whose first session cannot open', () => {
    // Given lane 0 connected and full, and a second lane whose connection throws on opening
    const { createTransport, built } = createTransports({ faults: { 1: 'open' } });
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);

    // When a new consumer connects, then the connect throws the opening's error
    expect(() => connectConsumer(lanes, 'local:e')).toThrow(FAULT);

    // And the chain reads connected again
    expect(statuses).toEqual(['connected', 'connecting', 'connected']);
  });

  it('As a paused chain, I build a new lane paused and open it on resume', () => {
    // Given paused lanes with lane 0 full, and a follow that opened lane 1
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, paused: true });
    const [first] = fillLaneZero(lanes);
    first.connection.send(createFollow(2));
    const statusWhilePaused = lanes.status();

    // When the chain resumes
    lanes.resume();

    // Then lane 1's transport was paused before it opened, the chain read disconnected while paused, and lane 1 resumed
    // and sent its follow
    expect(nth(built, 1).calls).toEqual(['pause', 'open', 'resume']);
    expect(statusWhilePaused).toBe('disconnected');
    expect(listSent(nth(built, 1), CHAIN_HEAD_FOLLOW)).toHaveLength(1);
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(4);
  });

  it('puts a follow past the limit on a new lane', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, followLimit: () => 2 });
    const consumers = ['a', 'b', 'c'].map(name => connectConsumer(lanes, `local:${name}`));

    for (const consumer of consumers) {
      consumer.connection.send(createFollow(1));
    }

    expect(built).toHaveLength(2);
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(2);
    expect(listSent(nth(built, 1), CHAIN_HEAD_FOLLOW)).toHaveLength(1);
  });

  it('sends a follow call to the lane that holds the follow', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, followLimit: () => 2 });
    const consumers = ['a', 'b', 'c'].map(name => connectConsumer(lanes, `local:${name}`));
    for (const consumer of consumers) {
      consumer.connection.send(createFollow(1));
    }
    nth(built, 1).answer(CHAIN_HEAD_FOLLOW);
    const third = consumers[2];
    expect(third).toBeDefined();
    if (third === undefined) {
      throw new Error('No third consumer');
    }
    const token = readAnswer(third, 1)['result'];

    third.connection.send({ jsonrpc: '2.0', id: 2, method: 'chainHead_v1_header', params: [token, '0x00'] });

    expect(listSent(nth(built, 1), 'chainHead_v1_header')).toHaveLength(1);
    expect(listSent(nth(built, 0), 'chainHead_v1_header')).toHaveLength(0);
  });

  it('closes an extra lane once its last session ends, never lane 0', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, followLimit: () => 2 });
    const consumers = ['a', 'b', 'c'].map(name => connectConsumer(lanes, `local:${name}`));
    for (const consumer of consumers) {
      consumer.connection.send(createFollow(1));
    }

    // The third consumer is homed on lane 0 and holds its follow's session on lane 1.
    consumers[2]?.connection.disconnect();
    const lane1Calls = [...nth(built, 1).calls];
    for (const consumer of consumers) {
      consumer.connection.disconnect();
    }

    expect(lane1Calls).toEqual(['open', 'disconnect']);
    expect(nth(built, 0).calls).toEqual(['open']);
  });

  it('reads the follow limit at each pick', () => {
    let limit = 1;
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, followLimit: () => limit });
    const first = connectConsumer(lanes, 'local:a');
    const second = connectConsumer(lanes, 'local:b');
    first.connection.send(createFollow(1));

    limit = 4;
    second.connection.send(createFollow(1));

    expect(built).toHaveLength(1);
    expect(listSent(nth(built, 0), CHAIN_HEAD_FOLLOW)).toHaveLength(2);
  });

  it('pauses, resumes and restarts every lane', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    fillLaneZero(lanes);
    connectConsumer(lanes, 'local:e');

    lanes.pause();
    lanes.resume();
    lanes.restart();

    expect(built.map(record => record.calls)).toEqual([
      ['open', 'pause', 'resume', 'restart'],
      ['open', 'pause', 'resume', 'restart'],
    ]);
  });

  it('keeps the lanes paused across a restart', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    const [consumer] = fillLaneZero(lanes);

    lanes.pause();
    lanes.restart();
    consumer.connection.send(createFollow(2));
    const newLaneCalls = [...nth(built, 1).calls];
    lanes.resume();

    expect(newLaneCalls).toEqual(['pause', 'open']);
    expect(built.map(record => record.calls.at(-1))).toEqual(['resume', 'resume']);
  });

  it('gives every lane the chain warner', () => {
    const warn = vi.fn<(kind: string, message: string) => void>();
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport, warn });
    fillLaneZero(lanes);
    connectConsumer(lanes, 'local:e');

    nth(built, 0).emit({ jsonrpc: '2.0', id: 'unknown-0', result: null });
    nth(built, 1).emit({ jsonrpc: '2.0', id: 'unknown-1', result: null });

    expect(warn.mock.calls.filter(([kind]) => kind === 'response_unknown_id')).toEqual([
      ['response_unknown_id', expect.stringContaining('unknown-0')],
      ['response_unknown_id', expect.stringContaining('unknown-1')],
    ]);
  });

  it('builds a lane paused and disconnected while the lanes are paused', () => {
    const { createTransport, built } = createTransports();
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');
    fillLaneZero(lanes);
    lanes.pause();

    connectConsumer(lanes, 'local:e');
    const statusBeforeReport = lanes.status();
    nth(built, 1).onStatus('connecting');

    expect(nth(built, 1).calls).toEqual(['pause', 'open']);
    expect(statusBeforeReport).toBe('disconnected');
    expect(lanes.status()).toBe('connecting');
    expect(statuses).toEqual(['connected', 'disconnected', 'connecting']);
  });

  it('keeps a connected status across pause and resume of a transport that cannot pause', () => {
    const { createTransport, built } = createTransports();
    const { lanes, statuses } = createLanes({ createTransport });
    nth(built, 0).onStatus('connected');

    lanes.pause();
    lanes.resume();

    expect(lanes.status()).toBe('connected');
    expect(statuses).toEqual(['connected']);
  });

  it('combines lane statuses', () => {
    const { createTransport, built } = createTransports();
    const { lanes } = createLanes({ createTransport });
    fillLaneZero(lanes);
    connectConsumer(lanes, 'local:e');

    nth(built, 0).onStatus('connected');
    const oneConnecting = lanes.status();
    nth(built, 1).onStatus('disconnected');
    const oneDisconnected = lanes.status();
    nth(built, 1).onStatus('connected');

    expect(oneConnecting).toBe('connecting');
    expect(oneDisconnected).toBe('disconnected');
    expect(lanes.status()).toBe('connected');
  });

  it('rejects a duplicate consumer and a connect after disconnectAll', () => {
    const { createTransport } = createTransports();
    const { lanes } = createLanes({ createTransport });
    connectConsumer(lanes, 'local:a');

    expect(() => connectConsumer(lanes, 'local:a')).toThrow('Duplicate test-chain consumer: local:a');

    lanes.disconnectAll();

    expect(() => connectConsumer(lanes, 'local:b')).toThrow('test-chain closed, so local:b cannot connect');
  });
});
