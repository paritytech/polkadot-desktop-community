export type PeopleChainStatus = 'connected' | 'reconnecting' | 'offline';

export type PeopleChainStatusResult = {
  networkName: string;
  status: PeopleChainStatus;
};
