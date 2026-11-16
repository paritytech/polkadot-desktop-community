// Type-only import — erased at emit, so the descriptor metadata is NEVER pulled
// into the runtime graph. Descriptors are used purely to TYPE the chain api
// (see `ChainApi` in ./types); the runtime is the unsafe api and the actual
// chain catalog comes from Firebase Remote Config (`chains_v2`).
import type * as PAPI from '@polkadot-api/descriptors';

export type Descriptors = {
  bulletin_paseo: PAPI.Bulletin_paseo;
  dot: PAPI.Dot;
  dot_ah: PAPI.Dot_ah;
  dot_col: PAPI.Dot_col;
  dot_ppl: PAPI.Dot_ppl;
  ksm: PAPI.Ksm;
  ksm_ah: PAPI.Ksm_ah;
  ksm_ppl: PAPI.Ksm_ppl;
  paseo: PAPI.Paseo;
  wnd: PAPI.Wnd;
  wnd_ah: PAPI.Wnd_ah;
};

// Enforced by smoldot's `chainHead_v1_follow` check, 2 per JSON-RPC client. truapi-provider gives each `connect` a client
// of its own, so the limit holds per connection.
export const LIGHT_CLIENT_FOLLOW_LIMIT = 2;
// Enforced by a Substrate RPC node, per connection.
export const RPC_FOLLOW_LIMIT = 4;
