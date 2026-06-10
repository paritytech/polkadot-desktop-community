/**
 * Fires whenever a local write touches a sync-tracked table (chat messages,
 * contacts). The orchestrator pokes every active sync state machine on each
 * emission so changes ship to peers without waiting for a DC reconnect.
 *
 * Echoes from applier writes are harmless — receivers dedup by message id and
 * contact accountId.
 */

import { Subject } from 'rxjs';

export const localSyncSignal$ = new Subject<void>();

export const signalLocalChange = (): void => {
  localSyncSignal$.next();
};
