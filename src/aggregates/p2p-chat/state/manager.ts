import { createState } from '@/shared/rxstate';
import { type P2PChatManager } from '@/domains/chat';

/**
 * The live P2P chat manager for the signed-in user, or `null` when chat isn't
 * running (no session, not paired, or disposed on logout).
 *
 * This is the cross-cutting *runtime* concern the aggregate owns: a feature
 * reading "is chat live / give me the manager" should not care how it was
 * constructed or torn down. Construction and disposal are driven by
 * `p2pChatUseCase` from the headless `P2PChatBinding`; the manager instance
 * itself (and all its internal transport bookkeeping) is a domain
 * orchestration primitive — the aggregate only owns its lifecycle. The
 * `RxState`'s own `.get` / `.set` / `.value$` API is the canonical surface.
 */
export const p2pChatManager$ = createState<P2PChatManager | null>(null);
