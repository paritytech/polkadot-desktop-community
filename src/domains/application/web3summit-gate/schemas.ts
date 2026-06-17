import * as v from 'valibot';

export const web3SummitGateModeSchema = v.picklist([
  'VERIFICATION_DISABLED',
  'VERIFICATION_ENABLED',
  'VERIFICATION_ENABLED_SKIPPABLE',
  'W3S_ENDED',
]);

export type Web3SummitGateMode = v.InferOutput<typeof web3SummitGateModeSchema>;
