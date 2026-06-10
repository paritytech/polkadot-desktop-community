/**
 * SCALE codecs for the device-sync wire format. Byte-for-byte parity with
 * Android (`SyncScale.kt`, `LocalMessageScale.kt`). Mismatched encoding here
 * silently corrupts sync. Variant ordinals are pinned below.
 *   SyncMessage  { Update=0, Ack=1 }
 *   SyncEntity   { Devices=0, ChatsAdded=1, ChatsRemoved=2, Messages=3 }
 *   ChatId       { Contact=0 }
 *   DeviceStatus { ACTIVE=0 }
 *   LocalStatus  { Outgoing(OutgoingStatus)=0, Incoming(IncomingStatus)=1 }
 *   OutgoingStatus { NEW=0, SENT=1, DELIVERED=2 }
 *   IncomingStatus { NEW=0, SEEN=1 }
 */

import { Bytes, Enum, Struct, Vector, _void, u32, u64 } from 'scale-ts';

// The chat-wire `ChatMessage` codec is owned by the chat domain (single source
// of truth with the 3-variant iOSVoIP Platform); device-sync reuses it so its
// envelopes decode identically to the live channels.
// eslint-disable-next-line boundaries/dependencies -- reuse chat's single ChatMessage wire codec; direct sub-path import keeps it wasm-free (same workaround as applier.ts/collector.ts)
import { ChatMessage as ChatMessageStatementCodec } from '@/domains/chat/p2p/wireChatMessage';

const AccountIdCodec = Bytes(32);
const EncrPublicKeyCodec = Bytes(65);

export { ChatMessageStatementCodec };

export const ChatIdCodec = Enum({
  Contact: AccountIdCodec, // 0
});

export const DeviceStatusCodec = Enum({
  ACTIVE: _void, // 0
});

export const OutgoingStatusCodec = Enum({
  NEW: _void, // 0
  SENT: _void, // 1
  DELIVERED: _void, // 2
});

export const IncomingStatusCodec = Enum({
  NEW: _void, // 0
  SEEN: _void, // 1
});

export const LocalStatusCodec = Enum({
  Outgoing: OutgoingStatusCodec, // 0
  Incoming: IncomingStatusCodec, // 1
});

export const LocalDeviceCodec = Struct({
  statementAccountId: AccountIdCodec,
  encryptionPublicKey: EncrPublicKeyCodec,
  status: DeviceStatusCodec,
  lastUpdate: u64,
});

export const LocalMessageCodec = Struct({
  remote: ChatMessageStatementCodec,
  peerId: AccountIdCodec,
  status: LocalStatusCodec,
  order: u64,
});

export const SyncEntityCodec = Enum({
  Devices: Vector(LocalDeviceCodec), // 0
  ChatsAdded: Vector(ChatIdCodec), // 1
  ChatsRemoved: Vector(ChatIdCodec), // 2
  Messages: Vector(LocalMessageCodec), // 3
});

export const SyncUpdateCodec = Struct({
  id: u32,
  entities: Vector(SyncEntityCodec),
  timePoint: u64,
});

export const SyncUpdateAckCodec = Struct({
  id: u32,
});

export const SyncMessageCodec = Enum({
  Update: SyncUpdateCodec, // 0
  Ack: SyncUpdateAckCodec, // 1
});
