/**
 * Public domain types for the device-sync feature. Wire types live in `codec.ts`;
 * these are storage / runtime types.
 */

export type DeviceSyncStatus = 'active' | 'removed';

export type KnownUserDevice = {
  statementAccountId: string; // hex
  encryptionPublicKey: string; // hex (P-256 uncompressed, 65 bytes)
  status: DeviceSyncStatus;
  lastUpdate: number; // ms since epoch
  outgoingUpdateTime: number; // last acked timePoint we sent to this peer
  /**
   * UUID of the most-recent device-sync signaling attempt acknowledged by
   * both ends. ABSENT until the first successful Offer/Answer round-trip:
   *
   *  - Acceptor writes it the moment it ADOPTS an incoming Offer's offerId
   *    (the Offer carries an offerId we know the initiator has minted).
   *  - Initiator writes it only after RECEIVING an Answer — proof the
   *    acceptor saw and adopted the same offerId.
   *
   * On (re)start we read this and send `reconnected(offerId)` so the peer
   * disposes the matching stale attempt instead of letting a 45s handshake
   * timeout drive the recovery.
   */
  lastOfferId?: string;
};

export type ChatIdValue = { type: 'contact'; accountId: string }; // SS58
