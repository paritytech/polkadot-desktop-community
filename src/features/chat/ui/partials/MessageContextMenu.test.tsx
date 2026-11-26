// @vitest-environment happy-dom

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';
import { type ChatMessage } from '@/domains/chat';

import { MessageContextMenu } from './MessageContextMenu';
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from './emoji-data';

// Tests are exempt from the no-`as` rule; the menu reads only these fields.
const message = {
  messageId: 'm1',
  content: { type: 'text', text: 'hello' },
  peer: { name: 'Me' },
  timestamp: 1,
  status: { direction: 'outgoing', state: 'sent' },
} as unknown as ChatMessage;

const renderMenu = (props: Partial<Parameters<typeof MessageContextMenu>[0]> = {}) => {
  const handlers = {
    onClose: vi.fn(),
    onReply: vi.fn(),
    onEdit: vi.fn(),
    onCopyText: vi.fn(),
    onToggleReaction: vi.fn(),
  };

  render(
    <TranslationProvider>
      <MessageContextMenu message={message} position={{ x: 10, y: 20 }} {...handlers} {...props} />
    </TranslationProvider>,
  );

  return handlers;
};

describe('MessageContextMenu', () => {
  it('renders its items, with the unwired ones disabled', async () => {
    renderMenu();

    expect(await screen.findByTestId(TEST_IDS.chatMessageContextMenu)).toHaveAttribute('role', 'menu');
    expect(screen.getByTestId(TEST_IDS.chatMessageContextMenuReply)).toHaveAttribute('role', 'menuitem');
    expect(screen.getByTestId(TEST_IDS.chatMessageContextMenuCopy)).toHaveAttribute('role', 'menuitem');
    expect(screen.getByTestId(TEST_IDS.chatMessageContextMenuEdit)).toHaveAttribute('role', 'menuitem');
    for (const testId of [
      TEST_IDS.chatMessageContextMenuForward,
      TEST_IDS.chatMessageContextMenuSelect,
      TEST_IDS.chatMessageContextMenuDelete,
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('omits reply and edit when no handlers are given', async () => {
    renderMenu({ onReply: undefined, onEdit: undefined });

    expect(await screen.findByTestId(TEST_IDS.chatMessageContextMenuCopy)).toBeInTheDocument();
    expect(screen.queryByTestId(TEST_IDS.chatMessageContextMenuReply)).toBeNull();
    expect(screen.queryByTestId(TEST_IDS.chatMessageContextMenuEdit)).toBeNull();
  });

  it('copies the text and closes', async () => {
    const user = userEvent.setup();
    const { onCopyText, onClose } = renderMenu();

    await user.click(await screen.findByTestId(TEST_IDS.chatMessageContextMenuCopy));

    expect(onCopyText).toHaveBeenCalledWith(message);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles a quick reaction and closes', async () => {
    const user = userEvent.setup();
    const { onToggleReaction, onClose } = renderMenu();
    const [emoji] = QUICK_REACTIONS;

    await user.click(await screen.findByRole('button', { name: emoji }));

    expect(onToggleReaction).toHaveBeenCalledWith('m1', emoji);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('swaps its content for the emoji picker and reacts from it', async () => {
    const user = userEvent.setup();
    const { onToggleReaction, onClose } = renderMenu();

    await user.click(await screen.findByTestId(TEST_IDS.chatEmojiPickerOpenButton));

    const picker = await screen.findByTestId(TEST_IDS.chatEmojiPicker);
    expect(screen.queryByTestId(TEST_IDS.chatQuickReactionsRow)).toBeNull();
    expect(screen.queryByTestId(TEST_IDS.chatMessageContextMenuCopy)).toBeNull();
    const [emoji] = EMOJI_CATEGORIES[0]?.emojis ?? [];
    await user.click(within(picker).getAllByRole('button', { name: emoji })[0]!);

    expect(onToggleReaction).toHaveBeenCalledWith('m1', emoji);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMenu();
    await screen.findByTestId(TEST_IDS.chatMessageContextMenu);

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
