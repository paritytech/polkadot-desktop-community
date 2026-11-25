# contact

The `contact` domain owns the local **address book**: each contact's public identity (`accountId`, identity chat key, and the
list of that contact's registered `Device`s), the persistence of that list, and the device-roster events through which the list is
kept current as contacts pair and unpair devices.

It is deliberately a **peer-identity** layer, not a session or transport one. It answers "who are my contacts, and which devices
does each one have?" — it does not open chat sessions, run the statement-store, or model _my own_ identity. A contact write is the
one place that also nudges device-sync, so a local change propagates to the user's other devices without waiting for a poll.

## Vocabulary

- **Contact** — a peer's public identity: `accountId` (their identity sr25519, hex), `identityChatPublicKey` (shared across their
  devices, used for topic derivation), and `devices[]`. An empty `devices[]` means the contact is on the legacy single-device
  protocol. Type: `Contact` in `identity/types.ts`.
- **Device** — one device registered against a contact: `statementAccountId` (sr25519, hex) + `encryptionPublicKey` (X25519,
  32 bytes, hex) for per-device ECDH key wrapping. Not to be confused with _this_ device (the `device` domain).
- **Device-roster event** — a `DeviceAdded` / `DeviceRemoved` statement a contact broadcasts when they pair/unpair a device, so
  peers can keep `Contact.devices[]` current. Codec: `DeviceRosterEvent` in `identity/schemas.ts` (the trust boundary for these
  wire events).
- **Roster topic** — the per-contact topic a user broadcasts their roster events on; recipients subscribe (matchAny) to every
  known contact's roster topic. Derived by `contactService.computeRosterTopic`.
- **Removal tombstone** — a marker written on a _local_ contact deletion so device-sync replicates the removal to the user's own
  devices; cleared on re-add. A removal through `deleteContactWithoutSync` — an inbound sync removal or a chat request cancel — writes no tombstone.

## Scope

This domain owns:

- **The contact list + tombstones** — Dexie persistence in `identity/repository.ts` (reads and raw writes).
- **Contact write commands** — `contactWriteUseCase` (`upsertContact` / `deleteContact` / `deleteContactWithoutSync`): the write
  chokepoint that persists _and_ signals device-sync (except `deleteContactWithoutSync`, for a removal every own device applies on its own).
- **Roster event decoding + application** — `identity/schemas.ts` (codecs) and `contactService.applyRosterEvent` (fold an event
  into a `Contact`).
- **The roster subscriber** — `rosterUseCase.startRosterSubscriber`: subscribes to known contacts' roster topics, verifies each
  event is signed by the contact's own identity key, and updates the list.

## Reading and writing contacts

Reads go through `contactRepository` (`get` / `list` / `listChangedSince` / `listRemovalsSince`). **Writes go through
`contactWriteUseCase`, not the repository** — `upsertContact` / `deleteContact` persist and then poke device-sync's local-change
pump; `deleteContactWithoutSync` drops the contact with no tombstone and no signal, for a removal every own device applies on its own — an inbound `ChatsRemoved`, and a chat request cancel, which every own device receives itself. Roster events arrive via
`rosterUseCase.startRosterSubscriber` and are applied through the same write path.

Rule of thumb: mutating the contact list = call `contactWriteUseCase`; only reads touch `contactRepository` directly.

## Boundaries

This domain does **not** own:

- **The statement-store transport / subscription primitive** — `trackedSubscribeStatements` and the store binding live in `chat`
  (the roster subscriber consumes them).
- **Device-sync** — collecting/replicating changes to the user's own devices is `device-sync`'s job; this domain only _signals_ it
  on a local write via `signalLocalChange`.
- **The user's own identity / device keys** — owned by `device` and `sso`. A `Contact` mirrors a _peer's_ identity, not the local
  user's.
- **Chat sessions / rooms** — session state is keyed off `accountId` but owned by `chat` (`P2PRoom`).

## References

- [`@novasamatech/statement-store`](https://www.npmjs.com/package/@novasamatech/statement-store) — the statement transport the
  roster subscriber reads over.
- [`scale-ts`](https://www.npmjs.com/package/scale-ts) — SCALE codecs for the device-roster events and roster-topic derivation.
- [`identity/types.ts`](./identity/types.ts) — the `Contact` / `Device` field reference.
