import * as v from 'valibot';

// Must stay in sync with the `Network` union accepted by host-chat's
// `createAccountService` (@novasamatech/host-chat/dist/accountService.d.ts).
// `hostChatNetwork` arrives from environment config — a trust boundary —
// so it is validated against the allowed set instead of being cast.
export const HostChatNetworkSchema = v.picklist(['paseo-next', 'paseo-next-v2', 'preview', 'stable', 'release', 'summit']);
