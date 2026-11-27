export type PeopleChainStatus = 'connected' | 'reconnecting' | 'offline';

export type PeopleChainStatusResult = {
  status: PeopleChainStatus;
};
