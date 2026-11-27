import { type RxState, createState } from '@/shared/rxstate';
import { type NetworkHealth, type NetworkMonitorModel, networkMonitorService } from '@/domains/network';

export const networkMonitor: {
  model: RxState<NetworkMonitorModel>;
  health: RxState<NetworkHealth>;
} = {
  model: createState(networkMonitorService.createModel([])),
  health: createState<NetworkHealth>('unused'),
};
