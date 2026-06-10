export type { Contact, Device } from './identity/types';
export { contactService } from './identity/service';
export { contactRepository } from './identity/repository';
export { DeviceAdded, DeviceRemoved, DeviceRosterEvent } from './identity/device-event-codec';
export { computeRosterSubscriptionTopics, computeRosterTopic } from './identity/rosterTopics';
export { startRosterSubscriber } from './identity/rosterSubscriber';
export type { RosterSubscriberDeps } from './identity/rosterSubscriber';
