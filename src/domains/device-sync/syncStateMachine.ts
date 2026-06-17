/**
 * Per-pair sync state machine: collect → send SyncUpdate → wait Ack, plus
 * inbound apply + Ack-emit. Reset on each fresh data channel; the durable
 * cursor lives in `outgoingUpdateTime` via caller-supplied advance/get fns.
 * Every in/out SyncMessage is logged for diagnostics.
 */

import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { DEVICE_SYNC_USE_CASE_ID, DataChannelMessageCodec } from '@/shared/peer-channel';

import { type SyncEntityCodec, SyncMessageCodec } from './codec';
import { type CollectedChanges } from './collector';

type SyncEntity = CodecType<typeof SyncEntityCodec>;
type SyncMessage = CodecType<typeof SyncMessageCodec>;

// How long to wait for an Ack before clearing `inflight` and resending the Update.
// Mirrors Android (DeviceSyncRunner.kt: withTimeoutOrNull(30.seconds)). Treats the
// symptom of a lost Update — the root cause (Update not reaching the peer) is separate.
const ACK_TIMEOUT_MS = 30_000;

function summarizeEntities(entities: SyncEntity[]): string {
  const parts: string[] = [];
  for (const e of entities) {
    if (e.tag === 'Devices') {
      parts.push(`Devices(${e.value.length})`);
      continue;
    }
    if (e.tag === 'ChatsAdded' || e.tag === 'ChatsRemoved') {
      const peers = e.value.map(c => (c.tag === 'Contact' ? toHex(c.value).slice(0, 10) : c.tag)).join(',');
      parts.push(`${e.tag}[${peers}]`);
      continue;
    }
    if (e.tag === 'Messages') {
      const msgs = e.value.map(m => {
        const tag = m.remote.versioned.tag === 'v1' ? m.remote.versioned.value.tag : m.remote.versioned.tag;
        const status = m.status.tag === 'Outgoing' ? `out/${m.status.value.tag}` : `in/${m.status.value.tag}`;
        return `${m.remote.messageId}:${tag}:${status}`;
      });
      parts.push(`Messages[${msgs.join('; ')}]`);
      continue;
    }
  }
  return parts.join(' ');
}

export type SyncStateMachineParams = {
  peerStatementAccountId: string;
  dataChannel: RTCDataChannel;
  collect: () => Promise<CollectedChanges>;
  apply: (entities: SyncEntity[]) => Promise<void>;
  getOutgoingUpdateTime: () => Promise<number>;
  advanceOutgoingUpdateTime: (peerId: string, timePoint: number) => Promise<void>;
  /** Ack wait before resending the in-flight Update. Defaults to {@link ACK_TIMEOUT_MS}. */
  ackTimeoutMs?: number;
};

export type SyncStateMachineHandle = {
  poke: () => void;
  close: () => void;
};

export function startSyncStateMachine(params: SyncStateMachineParams): SyncStateMachineHandle {
  const { dataChannel, collect, apply, advanceOutgoingUpdateTime } = params;
  const ackTimeoutMs = params.ackTimeoutMs ?? ACK_TIMEOUT_MS;
  let nextId = 1;
  let inflight: { id: number; timePoint: number } | null = null;
  let ackTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAppliedInboundId = 0;
  let closed = false;

  console.debug('WEBRTC [sync] started peer=%s dataChannel.state=%s', params.peerStatementAccountId, dataChannel.readyState);

  function send(sync: SyncMessage): void {
    const data = SyncMessageCodec.enc(sync);
    const envelope = DataChannelMessageCodec.enc({
      id: DEVICE_SYNC_USE_CASE_ID,
      data,
    });
    const buffer = new ArrayBuffer(envelope.byteLength);
    new Uint8Array(buffer).set(envelope);
    console.debug(
      'WEBRTC [sync] OUT raw bytesLen=%d peer=%s tag=%s payloadHex=%s envelopeHex=%s',
      envelope.length,
      params.peerStatementAccountId,
      sync.tag,
      toHex(data),
      toHex(envelope),
    );
    console.debug(
      'WEBRTC [sync] OUT decoded peer=%s\n%s',
      params.peerStatementAccountId,
      JSON.stringify(sync, (_k, v) => (typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? toHex(v) : v), 2),
    );
    try {
      dataChannel.send(buffer);
    } catch (err) {
      console.error('WEBRTC [sync] dataChannel.send failed: %s', err instanceof Error ? err.message : String(err));
    }
  }

  function clearAckTimer(): void {
    if (ackTimer !== null) {
      clearTimeout(ackTimer);
      ackTimer = null;
    }
  }

  function armAckTimer(): void {
    clearAckTimer();
    ackTimer = setTimeout(onAckTimeout, ackTimeoutMs);
  }

  function onAckTimeout(): void {
    ackTimer = null;
    if (closed || !inflight) return;
    console.warn(
      'WEBRTC [sync] no Ack for Update id=%d within %dms peer=%s — clearing inflight and resending',
      inflight.id,
      ackTimeoutMs,
      params.peerStatementAccountId,
    );
    // Do NOT advance outgoingUpdateTime: with the cursor unchanged, the resend collects the
    // same (or a superset of) changes and ships them with a fresh id, exactly like Android.
    inflight = null;
    void pump();
  }

  async function pump(): Promise<void> {
    if (closed) return;
    if (inflight) return;
    let changes: CollectedChanges;
    try {
      changes = await collect();
    } catch (err) {
      console.error('WEBRTC [sync] collect() failed: %s', err instanceof Error ? err.message : String(err));
      return;
    }
    if (changes.entities.length === 0) return;
    const id = nextId++;
    inflight = { id, timePoint: changes.timePoint };
    const entitySummary = changes.entities
      .map(e => {
        const count = 'value' in e && Array.isArray(e.value) ? e.value.length : 0;
        if (e.tag === 'Messages') {
          const tags = e.value.map(m => (m.remote.versioned.tag === 'v1' ? m.remote.versioned.value.tag : '?')).join('|');
          return `Messages(${count}: ${tags})`;
        }
        return `${e.tag}(${count})`;
      })
      .join(',');
    const allMessageTags = changes.entities
      .filter(e => e.tag === 'Messages')
      .flatMap(e => (e.tag === 'Messages' ? e.value : []))
      .map(m => (m.remote.versioned.tag === 'v1' ? m.remote.versioned.value.tag : '?'));
    const hasChatsAdded = changes.entities.some(e => e.tag === 'ChatsAdded');
    const hasAcceptEvent =
      hasChatsAdded || allMessageTags.includes('contactAdded') || allMessageTags.includes('deviceChatAccepted');
    const acceptFlag = hasAcceptEvent ? ' [accept-event]' : '';
    console.debug(
      'WEBRTC [sync] OUT Update id=%d timePoint=%d peer=%s entities=%s%s',
      id,
      changes.timePoint,
      params.peerStatementAccountId,
      entitySummary,
      acceptFlag,
    );
    send({
      tag: 'Update',
      value: { id, entities: changes.entities, timePoint: BigInt(changes.timePoint) },
    });
    armAckTimer();
  }

  async function onMessage(ev: MessageEvent<ArrayBuffer | Uint8Array>): Promise<void> {
    const bytes = ev.data instanceof Uint8Array ? ev.data : new Uint8Array(ev.data);
    console.debug(
      'WEBRTC [sync] IN raw bytesLen=%d dcState=%s peer=%s firstBytes=%s',
      bytes.length,
      dataChannel.readyState,
      params.peerStatementAccountId,
      toHex(bytes.slice(0, Math.min(64, bytes.length))),
    );
    let envelope;
    try {
      envelope = DataChannelMessageCodec.dec(bytes);
    } catch (err) {
      console.warn(
        'WEBRTC [sync] envelope decode failed dataLen=%d firstBytes=%s err=%s',
        bytes.length,
        toHex(bytes.slice(0, Math.min(64, bytes.length))),
        err instanceof Error ? err.message : String(err),
      );
      return;
    }
    console.debug('WEBRTC [sync] IN envelope id=%s dataLen=%d', envelope.id, envelope.data.length);
    if (envelope.id !== DEVICE_SYNC_USE_CASE_ID) {
      console.debug('WEBRTC [sync] IN envelope id=%s ignored (not device-sync use-case)', envelope.id);
      return;
    }
    let sync: SyncMessage;
    try {
      sync = SyncMessageCodec.dec(envelope.data);
    } catch (err) {
      // Hex prefix + tail let us pinpoint which entity blew up the decoder.
      console.warn(
        'WEBRTC [sync] SyncMessage decode failed dataLen=%d firstBytes=%s err=%s',
        envelope.data.length,
        toHex(envelope.data.slice(0, Math.min(64, envelope.data.length))),
        err instanceof Error ? err.message : String(err),
      );
      if (envelope.data.length > 64) {
        console.warn(
          'WEBRTC [sync] SyncMessage decode failed lastBytes=%s',
          toHex(envelope.data.slice(Math.max(0, envelope.data.length - 32))),
        );
      }
      console.warn('WEBRTC [sync] SyncMessage decode failed fullBytes=%s', toHex(envelope.data));
      return;
    }
    if (sync.tag === 'Update') {
      console.debug(
        'WEBRTC [sync] IN Update id=%d timePoint=%s entities=%s',
        sync.value.id,
        sync.value.timePoint.toString(),
        summarizeEntities(sync.value.entities),
      );
      if (sync.value.id <= lastAppliedInboundId) {
        send({ tag: 'Ack', value: { id: sync.value.id } });
        return;
      }
      try {
        await apply(sync.value.entities);
      } catch (err) {
        console.error('WEBRTC [sync] apply() failed: %s', err instanceof Error ? err.message : String(err));
        return; // don't Ack — peer will retry
      }
      lastAppliedInboundId = sync.value.id;
      send({ tag: 'Ack', value: { id: sync.value.id } });
    } else if (sync.tag === 'Ack') {
      if (!inflight || inflight.id !== sync.value.id) return;
      clearAckTimer();
      const advancedTo = inflight.timePoint;
      inflight = null;
      try {
        await advanceOutgoingUpdateTime(params.peerStatementAccountId, advancedTo);
      } catch (err) {
        console.error('WEBRTC [sync] advanceOutgoingUpdateTime failed: %s', err instanceof Error ? err.message : String(err));
      }
      void pump();
    }
  }

  function listener(ev: MessageEvent): void {
    void onMessage(ev);
  }
  dataChannel.addEventListener('message', listener);

  void pump();

  return {
    poke: () => void pump(),
    close: () => {
      closed = true;
      clearAckTimer();
      dataChannel.removeEventListener('message', listener);
    },
  };
}
