// @vitest-environment happy-dom

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type MouseEvent, useRef, useState } from 'react';
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

const incoming = {
  ...message,
  messageId: 'm2',
  status: { direction: 'incoming', state: 'sent' },
} as unknown as ChatMessage;

// Stands in for MessageFlow and Room: the menu lives in state the bubbles set, and Reply focuses the composer.
const Conversation = ({ onClose }: { onClose: VoidFunction }) => {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [menu, setMenu] = useState<{ message: ChatMessage; position: { x: number; y: number } } | null>(null);

  const openMenu = (event: MouseEvent, target: ChatMessage) => {
    event.preventDefault();
    setMenu({ message: target, position: { x: event.clientX, y: event.clientY } });
  };

  return (
    <TranslationProvider>
      <textarea ref={composerRef} aria-label="Composer" />
      <p onContextMenu={event => openMenu(event, message)}>outgoing bubble</p>
      <p onContextMenu={event => openMenu(event, incoming)}>incoming bubble</p>
      {menu ? (
        <MessageContextMenu
          message={menu.message}
          position={menu.position}
          onClose={() => {
            onClose();
            setMenu(null);
          }}
          onReply={() => composerRef.current?.focus()}
          onEdit={vi.fn()}
          onCopyText={vi.fn()}
        />
      ) : null}
    </TranslationProvider>
  );
};

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

  it('anchors at the pointer from the document body', async () => {
    renderMenu();
    await screen.findByTestId(TEST_IDS.chatMessageContextMenu);

    const anchor = document.querySelector('[aria-haspopup="menu"]');
    expect(anchor?.parentElement).toBe(document.body);
    expect(anchor).toHaveStyle({ left: '10px', top: '20px' });
  });

  it('leaves the composer focused after Reply', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Conversation onClose={onClose} />);

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('outgoing bubble') });
    await user.click(await screen.findByTestId(TEST_IDS.chatMessageContextMenuReply));

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatMessageContextMenu)).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Composer' })).toHaveFocus();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens the next message's menu on a right-click while one is open", async () => {
    const user = userEvent.setup();
    render(<Conversation onClose={vi.fn()} />);

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('outgoing bubble') });
    expect(await screen.findByTestId(TEST_IDS.chatMessageContextMenuEdit)).toBeInTheDocument();

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('incoming bubble') });

    await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatMessageContextMenuEdit)).toBeNull());
    expect(screen.getByTestId(TEST_IDS.chatMessageContextMenu)).toBeInTheDocument();
  });
});
