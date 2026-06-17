export type AcceptorDevice = {
  statementAccountId: Uint8Array;
  encryptionPublicKey: Uint8Array;
};

export type AcceptSignal = {
  requestId: string;
  /**
   * `null` when the peer is on the Android-legacy `chatAccepted @14` path —
   * the caller must synthesise an identity-conflated entry in that case.
   */
  acceptorDevice: AcceptorDevice | null;
  /**
   * The acceptor's wire timestamp (ms) from the `ChatMessage` envelope. The
   * caller stamps the synthetic accept rows with this instead of local
   * `Date.now()` so the event sorts to where the acceptance actually happened
   * — both locally and after `device-sync` replicates it to sibling devices.
   */
  acceptedAt: number;
};

export type IdentityChannelEvent =
  | { tag: 'acceptSignal'; signal: AcceptSignal }
  | { tag: 'deviceAdded'; statementAccountId: Uint8Array; encryptionPublicKey: Uint8Array }
  | { tag: 'deviceRemoved'; statementAccountId: Uint8Array };
