import { toHex } from 'polkadot-api/utils';
import { type CodecType } from 'scale-ts';

import { type DeviceRosterEvent } from './device-event-codec';
import { type Contact, type Device } from './types';

const hasKnownDevices = (contact: Contact): boolean => contact.devices.length > 0;

const addDevice = (contact: Contact, device: Device): Contact => {
  const without = contact.devices.filter(d => d.statementAccountId !== device.statementAccountId);
  return {
    ...contact,
    devices: [...without, device],
  };
};

const removeDevice = (contact: Contact, statementAccountId: string): Contact => ({
  ...contact,
  devices: contact.devices.filter(d => d.statementAccountId !== statementAccountId),
});

// Translates a decoded DeviceRosterEvent (bytes) into the equivalent
// hex-string mutation on a Contact. The codec deals in Uint8Array because
// SCALE bytes are bytes; the persisted Contact deals in hex strings to
// match the rest of the chat domain.
const applyRosterEvent = (contact: Contact, event: CodecType<typeof DeviceRosterEvent>): Contact => {
  switch (event.tag) {
    case 'DeviceAdded':
      return addDevice(contact, {
        statementAccountId: toHex(event.value.statementAccountId),
        encryptionPublicKey: toHex(event.value.encryptionPublicKey),
      });
    case 'DeviceRemoved':
      return removeDevice(contact, toHex(event.value.statementAccountId));
  }
};

export const contactService = {
  hasKnownDevices,
  addDevice,
  removeDevice,
  applyRosterEvent,
};
