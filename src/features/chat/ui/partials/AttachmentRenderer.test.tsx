// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type FileAttachment } from '@/domains/chat';

import { AttachmentRenderer } from './AttachmentRenderer';

// The core invariant: rendering an attachment must NEVER trigger a HOP claim on
// desktop. We replace the whole chat domain module with a spy so any future
// re-introduction of a download call fails this suite loudly.
const downloadChatFileMock = vi.fn();
vi.mock('@/domains/chat', () => ({
  downloadChatFile: (...args: unknown[]) => downloadChatFileMock(...args),
}));

const PLACEHOLDER_TEXT = 'This message can only be viewed in the mobile app';

const imageAttachment: FileAttachment = {
  identifier: new Uint8Array([1, 2, 3]),
  claimTicket: new Uint8Array([4, 5, 6]),
  meta: { type: 'image', mimeType: 'image/png', fileSize: 1000, width: 100, height: 80 },
};
const videoAttachment: FileAttachment = {
  identifier: new Uint8Array([7, 8, 9]),
  claimTicket: new Uint8Array([10, 11, 12]),
  meta: { type: 'video', mimeType: 'video/mp4', fileSize: 4096, duration: 30 },
};
const fileAttachment: FileAttachment = {
  identifier: new Uint8Array([13, 14, 15]),
  claimTicket: new Uint8Array([16, 17, 18]),
  meta: { type: 'general', mimeType: 'application/pdf', fileSize: 2048 },
};
const imageWithBlurhash: FileAttachment = {
  identifier: new Uint8Array([19, 20, 21]),
  claimTicket: new Uint8Array([22, 23, 24]),
  meta: {
    type: 'image',
    mimeType: 'image/png',
    fileSize: 1000,
    width: 100,
    height: 80,
    blurhash: 'LKO2?U%2Tw=w]~RBVZRi};RPxuwH',
  },
};

const renderRenderer = (attachments: FileAttachment[], isMe: boolean) =>
  render(
    <TranslationProvider>
      <AttachmentRenderer attachments={attachments} isMe={isMe} />
    </TranslationProvider>,
  );

describe('AttachmentRenderer', () => {
  it.each([
    ['image', imageAttachment],
    ['video', videoAttachment],
    ['general file', fileAttachment],
  ])('renders the mobile-only placeholder for an %s attachment', (_label, attachment) => {
    renderRenderer([attachment], false);

    expect(screen.getByTestId(TEST_IDS.chatMediaPlaceholder)).toBeInTheDocument();
    expect(screen.getByText(PLACEHOLDER_TEXT)).toBeInTheDocument();
  });

  it.each([[true], [false]])('renders a placeholder per attachment regardless of isMe (%s)', isMe => {
    renderRenderer([imageAttachment, videoAttachment, fileAttachment], isMe);

    expect(screen.getAllByTestId(TEST_IDS.chatMediaPlaceholder)).toHaveLength(3);
  });

  it('renders the blurhash preview only when the attachment carries one', () => {
    renderRenderer([imageWithBlurhash], false);

    expect(screen.getByTestId(TEST_IDS.chatMediaPlaceholderBlurhash)).toBeInTheDocument();
  });

  it.each([
    ['image without thumbnail', imageAttachment],
    ['general file', fileAttachment],
  ])('renders no blurhash preview for an %s', (_label, attachment) => {
    renderRenderer([attachment], false);

    expect(screen.queryByTestId(TEST_IDS.chatMediaPlaceholderBlurhash)).not.toBeInTheDocument();
  });

  it('never triggers a HOP download when rendering attachments', () => {
    renderRenderer([imageAttachment, videoAttachment, fileAttachment, imageWithBlurhash], true);

    expect(downloadChatFileMock).not.toHaveBeenCalled();
  });
});
