import { type Web3SummitGateMode } from './schemas';

const DEFAULT_GATE_MODE: Web3SummitGateMode = 'VERIFICATION_ENABLED';

export const web3SummitGateService = {
  resolveGateMode: (mode: Nullable<Web3SummitGateMode>): Web3SummitGateMode => mode ?? DEFAULT_GATE_MODE,
  isW3sEnded: (mode: Web3SummitGateMode): boolean => mode === 'W3S_ENDED',
};
