import { beforeEach, describe, expect, it, vi } from 'vitest';

const signalLocalChange = vi.fn();
vi.mock(import('@/domains/device-sync'), async importOriginal => ({
  ...(await importOriginal()),
  signalLocalChange: () => signalLocalChange(),
}));

import { contactRepository } from '../identity/repository';

import { contactWriteUseCase } from './write';

// The repository is a plain object, spied in place; nothing reaches Dexie.
const upsert = vi.spyOn(contactRepository, 'upsert').mockResolvedValue();
const del = vi.spyOn(contactRepository, 'delete').mockResolvedValue();
const applyRemoteDelete = vi.spyOn(contactRepository, 'applyRemoteDelete').mockResolvedValue();

const contact = { accountId: '0xabc', identityChatPublicKey: '0x04', devices: [] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contactWriteUseCase', () => {
  it('upsertContact persists then signals a local change', async () => {
    await contactWriteUseCase.upsertContact(contact);

    expect(upsert).toHaveBeenCalledWith(contact);
    expect(signalLocalChange).toHaveBeenCalledOnce();
  });

  it('deleteContact persists then signals a local change', async () => {
    await contactWriteUseCase.deleteContact('0xabc');

    expect(del).toHaveBeenCalledWith('0xabc');
    expect(signalLocalChange).toHaveBeenCalledOnce();
  });

  it('deleteContactWithoutSync drops WITHOUT signalling (no echo back to peers)', async () => {
    await contactWriteUseCase.deleteContactWithoutSync('0xabc');

    expect(applyRemoteDelete).toHaveBeenCalledWith('0xabc');
    expect(signalLocalChange).not.toHaveBeenCalled();
  });
});
