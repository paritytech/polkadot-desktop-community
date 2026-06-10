import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { MinimalCandidatesVecCodec, encodeMinimalSetup, rtcCandidateToMinimal } from '@/shared/peer-channel';
import { type SyncSignalingEnvelope } from '@/domains/device-session';

import { startSignaler } from './signaler';

const tick = () => new Promise(r => setTimeout(r, 10));

/** A SCALE(MinimalSetup) blob the signaler can decode without throwing. */
const setupBytes = () => encodeMinimalSetup('fake-sdp');

const offerEnvelope = (offerId: string): SyncSignalingEnvelope => ({
  offerId,
  message: { tag: 'Offer', value: { sdp: setupBytes() } },
});

// A minimal RTCIceCandidate-shaped stub — the helper only reads
// protocol/address/port/type/foundation/priority, so a structural mock works.
type CandidateFields = { protocol: string; address: string; port: number; type: string; foundation: string; priority: number };
const stubCandidate = (fields: CandidateFields): RTCIceCandidate =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- structural mock; rtcCandidateToMinimal only reads the fields above
  fields as unknown as RTCIceCandidate;

const fakeIceCandidate = stubCandidate({
  protocol: 'udp',
  address: '1.2.3.4',
  port: 1234,
  type: 'host',
  foundation: '1',
  priority: 1,
});

/** One real candidate, encoded the way the signaler expects on the wire. */
const candidatesEnvelope = (offerId: string): SyncSignalingEnvelope => {
  const minimal = rtcCandidateToMinimal(fakeIceCandidate)!;
  return { offerId, message: { tag: 'Candidates', value: { candidates: MinimalCandidatesVecCodec.enc([minimal]) } } };
};

const makeAcceptorPeerConn = () => {
  const localCandidates$ = new Subject<RTCIceCandidate>();
  const peerConn = {
    role: 'acceptor' as const,
    createOffer: vi.fn(() => Promise.resolve({ type: 'offer' as const, sdp: 'fake-sdp' })),
    createAnswer: vi.fn(() => Promise.resolve({ type: 'answer' as const, sdp: 'fake-sdp' })),
    applyRemoteOffer: vi.fn(async () => {}),
    applyRemoteAnswer: vi.fn(async () => {}),
    applyRemoteRollback: vi.fn(async () => {}),
    addRemoteCandidate: vi.fn(),
    localCandidates$: localCandidates$.asObservable(),
    dataChannel: null,
    dataChannelOpen$: new Subject<RTCDataChannel>().asObservable(),
    connectionState: vi.fn<() => RTCPeerConnectionState>().mockReturnValue('new'),
    signalingState: vi.fn<() => RTCSignalingState>().mockReturnValue('stable'),
    connectionState$: new BehaviorSubject<RTCPeerConnectionState>('new').asObservable(),
    close: vi.fn(),
  };
  return { peerConn, localCandidates$ };
};

describe('startSignaler — initiator', () => {
  it('mints an offerId and sends an Offer envelope after createOffer', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const localCandidates$ = new Subject<RTCIceCandidate>();
    const dataChannelOpen$ = new Subject<RTCDataChannel>();

    const session = {
      send: (e: SyncSignalingEnvelope) => {
        sent.push(e);
        return Promise.resolve();
      },
      messages$: sessionMessages$.asObservable(),
      close: vi.fn(),
    };

    const peerConn = {
      role: 'initiator' as const,
      createOffer: vi.fn(() => Promise.resolve({ type: 'offer' as const, sdp: 'fake-sdp' })),
      createAnswer: vi.fn(),
      applyRemoteOffer: vi.fn(),
      applyRemoteAnswer: vi.fn(async () => {}),
      applyRemoteRollback: vi.fn(async () => {}),
      addRemoteCandidate: vi.fn(),
      localCandidates$: localCandidates$.asObservable(),
      dataChannel: null,
      dataChannelOpen$: dataChannelOpen$.asObservable(),
      connectionState: vi.fn<() => RTCPeerConnectionState>().mockReturnValue('new'),
      signalingState: vi.fn<() => RTCSignalingState>().mockReturnValue('stable'),
      connectionState$: new BehaviorSubject<RTCPeerConnectionState>('new').asObservable(),
      close: vi.fn(),
    };

    const handle = startSignaler({ session, peerConnection: peerConn, role: 'initiator' });

    await new Promise(r => setTimeout(r, 10));
    expect(peerConn.createOffer).toHaveBeenCalled();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]!.message.tag).toBe('Offer');
    // offerId is a non-empty UUID string.
    expect(typeof sent[0]!.offerId).toBe('string');
    expect(sent[0]!.offerId.length).toBeGreaterThan(0);
    handle.close();
  });

  it('drops an Answer whose offerId does not match the current Offer', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const localCandidates$ = new Subject<RTCIceCandidate>();
    const dataChannelOpen$ = new Subject<RTCDataChannel>();

    const session = {
      send: (e: SyncSignalingEnvelope) => {
        sent.push(e);
        return Promise.resolve();
      },
      messages$: sessionMessages$.asObservable(),
      close: vi.fn(),
    };

    const applyRemoteAnswer = vi.fn(async () => {});
    const peerConn = {
      role: 'initiator' as const,
      createOffer: vi.fn(() => Promise.resolve({ type: 'offer' as const, sdp: 'fake-sdp' })),
      createAnswer: vi.fn(),
      applyRemoteOffer: vi.fn(),
      applyRemoteAnswer,
      applyRemoteRollback: vi.fn(async () => {}),
      addRemoteCandidate: vi.fn(),
      localCandidates$: localCandidates$.asObservable(),
      dataChannel: null,
      dataChannelOpen$: dataChannelOpen$.asObservable(),
      connectionState: vi.fn<() => RTCPeerConnectionState>().mockReturnValue('new'),
      signalingState: vi.fn<() => RTCSignalingState>().mockReturnValue('have-local-offer'),
      connectionState$: new BehaviorSubject<RTCPeerConnectionState>('new').asObservable(),
      close: vi.fn(),
    };

    const handle = startSignaler({ session, peerConnection: peerConn, role: 'initiator' });
    await new Promise(r => setTimeout(r, 10));

    // A stale Answer carrying a foreign offerId must be dropped — never applied.
    sessionMessages$.next({
      offerId: 'some-other-stale-offer-id',
      message: { tag: 'Answer', value: { sdp: new Uint8Array([1, 2, 3]) } },
    });
    await new Promise(r => setTimeout(r, 10));

    expect(applyRemoteAnswer).not.toHaveBeenCalled();
    handle.close();
  });

  it('requests reset when a Reconnected matches the current offerId', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const localCandidates$ = new Subject<RTCIceCandidate>();
    const dataChannelOpen$ = new Subject<RTCDataChannel>();

    const session = {
      send: (e: SyncSignalingEnvelope) => {
        sent.push(e);
        return Promise.resolve();
      },
      messages$: sessionMessages$.asObservable(),
      close: vi.fn(),
    };

    const peerConn = {
      role: 'initiator' as const,
      createOffer: vi.fn(() => Promise.resolve({ type: 'offer' as const, sdp: 'fake-sdp' })),
      createAnswer: vi.fn(),
      applyRemoteOffer: vi.fn(),
      applyRemoteAnswer: vi.fn(async () => {}),
      applyRemoteRollback: vi.fn(async () => {}),
      addRemoteCandidate: vi.fn(),
      localCandidates$: localCandidates$.asObservable(),
      dataChannel: null,
      dataChannelOpen$: dataChannelOpen$.asObservable(),
      connectionState: vi.fn<() => RTCPeerConnectionState>().mockReturnValue('new'),
      signalingState: vi.fn<() => RTCSignalingState>().mockReturnValue('have-local-offer'),
      connectionState$: new BehaviorSubject<RTCPeerConnectionState>('new').asObservable(),
      close: vi.fn(),
    };

    const onResetRequest = vi.fn();
    const handle = startSignaler({ session, peerConnection: peerConn, role: 'initiator', onResetRequest });
    await new Promise(r => setTimeout(r, 10));

    const myOfferId = sent[0]!.offerId;

    // A Reconnected for a DIFFERENT offerId is ignored.
    sessionMessages$.next({ offerId: 'unrelated', message: { tag: 'Reconnected', value: undefined } });
    await new Promise(r => setTimeout(r, 10));
    expect(onResetRequest).not.toHaveBeenCalled();

    // A Reconnected for OUR current offerId triggers the reset.
    sessionMessages$.next({ offerId: myOfferId, message: { tag: 'Reconnected', value: undefined } });
    await new Promise(r => setTimeout(r, 10));
    expect(onResetRequest).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('requests reset at most once per signaler even if the matching Reconnected is replayed', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const session = {
      send: (e: SyncSignalingEnvelope) => {
        sent.push(e);
        return Promise.resolve();
      },
      messages$: sessionMessages$.asObservable(),
      close: vi.fn(),
    };
    const { peerConn } = makeAcceptorPeerConn();
    // Reuse the acceptor mock shape but drive it as an initiator.
    const initiatorConn = {
      ...peerConn,
      role: 'initiator' as const,
      signalingState: vi.fn<() => RTCSignalingState>().mockReturnValue('have-local-offer'),
    };

    const onResetRequest = vi.fn();
    const handle = startSignaler({ session, peerConnection: initiatorConn, role: 'initiator', onResetRequest });
    await tick();
    const myOfferId = sent[0]!.offerId;

    // The persistent statement-store can re-deliver the same Reconnected; only
    // the first one may drive a respawn — further replays must be no-ops.
    sessionMessages$.next({ offerId: myOfferId, message: { tag: 'Reconnected', value: undefined } });
    sessionMessages$.next({ offerId: myOfferId, message: { tag: 'Reconnected', value: undefined } });
    await tick();

    expect(onResetRequest).toHaveBeenCalledTimes(1);
    handle.close();
  });
});

describe('startSignaler — acceptor', () => {
  const makeSession = (sent: SyncSignalingEnvelope[], sessionMessages$: Subject<SyncSignalingEnvelope>) => ({
    send: (e: SyncSignalingEnvelope) => {
      sent.push(e);
      return Promise.resolve();
    },
    messages$: sessionMessages$.asObservable(),
    close: vi.fn(),
  });

  it('adopts the first Offer, drops a same-id duplicate, and resets on a different-id Offer (restarted initiator)', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const { peerConn } = makeAcceptorPeerConn();
    const onAcceptedOfferId = vi.fn();
    const onResetRequest = vi.fn();

    const handle = startSignaler({
      session: makeSession(sent, sessionMessages$),
      peerConnection: peerConn,
      role: 'acceptor',
      onAcceptedOfferId,
      onResetRequest,
    });

    // First Offer is adopted: applied + answered + persisted.
    sessionMessages$.next(offerEnvelope('A'));
    await tick();
    expect(peerConn.applyRemoteOffer).toHaveBeenCalledTimes(1);
    expect(onAcceptedOfferId).toHaveBeenCalledWith('A');
    expect(sent.some(e => e.message.tag === 'Answer' && e.offerId === 'A')).toBe(true);

    // A same-id Offer (statement-store replay) is a no-op — not re-applied,
    // no reset. The PC's mid-handshake DTLS must not be torn down.
    peerConn.connectionState.mockReturnValue('connecting');
    sessionMessages$.next(offerEnvelope('A'));
    await tick();
    expect(peerConn.applyRemoteOffer).toHaveBeenCalledTimes(1);
    expect(onResetRequest).not.toHaveBeenCalled();

    // A different-id Offer means the initiator restarted; our PC is stale.
    // Request a reset (orchestrator respawns a fresh PC) — do NOT re-adopt in
    // place, even while the dead PC still reports 'connected'.
    peerConn.connectionState.mockReturnValue('connected');
    sessionMessages$.next(offerEnvelope('B'));
    await tick();
    expect(onResetRequest).toHaveBeenCalledTimes(1);
    expect(peerConn.applyRemoteOffer).toHaveBeenCalledTimes(1);

    handle.close();
  });

  it('tags trickle candidates with the adopted offerId, never a later offer’s id', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const { peerConn, localCandidates$ } = makeAcceptorPeerConn();

    const handle = startSignaler({
      session: makeSession(sent, sessionMessages$),
      peerConnection: peerConn,
      role: 'acceptor',
      onResetRequest: vi.fn(),
    });

    sessionMessages$.next(offerEnvelope('A'));
    await tick();

    localCandidates$.next(fakeIceCandidate);
    await tick();

    // A different-id Offer arrives (would re-adopt under the old code); since we
    // never re-adopt, currentOfferId stays 'A'.
    sessionMessages$.next(offerEnvelope('B'));
    await tick();
    localCandidates$.next(fakeIceCandidate);
    await tick();

    const candidateSends = sent.filter(e => e.message.tag === 'Candidates');
    expect(candidateSends.length).toBeGreaterThan(0);
    expect(candidateSends.every(e => e.offerId === 'A')).toBe(true);

    handle.close();
  });

  it('stops processing queued inbound messages after close (no work against a torn-down PC)', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const { peerConn } = makeAcceptorPeerConn();

    // Mirror the orchestrator: a matching Reconnected disposes the signaler.
    // `refs` carrier avoids a forward `let` (the close callback is only invoked
    // after startSignaler has returned and assigned the handle).
    const refs: { handle?: ReturnType<typeof startSignaler> } = {};
    const onResetRequest = () => refs.handle?.close();
    refs.handle = startSignaler({
      session: makeSession(sent, sessionMessages$),
      peerConnection: peerConn,
      role: 'acceptor',
      onResetRequest,
    });

    sessionMessages$.next(offerEnvelope('A'));
    await tick();
    expect(peerConn.addRemoteCandidate).not.toHaveBeenCalled(); // adopted offer carried no candidates

    // One statement, one batch: [Reconnected{A}, Candidates{A}]. channel.ts
    // emits both synchronously, so both are queued before the first runs. The
    // Reconnected closes the signaler; the queued Candidates must NOT touch the
    // now-closed PC.
    sessionMessages$.next({ offerId: 'A', message: { tag: 'Reconnected', value: undefined } });
    sessionMessages$.next(candidatesEnvelope('A'));
    await tick();

    expect(peerConn.addRemoteCandidate).not.toHaveBeenCalled();
  });

  it('does not answer when close() races an in-flight Offer (external respawn mid-handler)', async () => {
    const sent: SyncSignalingEnvelope[] = [];
    const sessionMessages$ = new Subject<SyncSignalingEnvelope>();
    const { peerConn } = makeAcceptorPeerConn();

    // Suspend the handler inside applyRemoteOffer so an external close() (a
    // handshake-timeout / connectionState respawn — independent of the inbound
    // queue) can land while the Offer handler is mid-await.
    let releaseApply = () => {};
    peerConn.applyRemoteOffer.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          releaseApply = resolve;
        }),
    );

    const handle = startSignaler({
      session: makeSession(sent, sessionMessages$),
      peerConnection: peerConn,
      role: 'acceptor',
      onResetRequest: vi.fn(),
    });

    sessionMessages$.next(offerEnvelope('A'));
    await tick(); // handler is now suspended at applyRemoteOffer

    handle.close(); // external respawn tears down the PC mid-handler
    releaseApply(); // applyRemoteOffer resolves; handler resumes
    await tick();

    // The resumed handler must bail after the close — never build/send an
    // Answer (createAnswer) against the torn-down PC.
    expect(peerConn.createAnswer).not.toHaveBeenCalled();
    expect(sent.some(e => e.message.tag === 'Answer')).toBe(false);
  });
});
