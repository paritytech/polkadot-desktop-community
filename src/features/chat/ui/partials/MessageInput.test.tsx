// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';

import { MessageInput } from './MessageInput';

const renderInput = (props: Partial<Parameters<typeof MessageInput>[0]> = {}) =>
  render(
    <TranslationProvider>
      <MessageInput submitAction={vi.fn().mockResolvedValue(undefined)} {...props} />
    </TranslationProvider>,
  );

describe('MessageInput', () => {
  it('disables the textarea and hides the send button when disabled', () => {
    renderInput({ disabled: true });

    const textarea = screen.getByTestId(TEST_IDS.chatMessageInput);
    expect(textarea).toBeDisabled();
    expect(screen.queryByTestId(TEST_IDS.chatSendButton)).toBeNull();
  });

  it('keeps the send button hidden even after typing when disabled', () => {
    renderInput({ disabled: true });

    fireEvent.change(screen.getByTestId(TEST_IDS.chatMessageInput), { target: { value: 'hello' } });

    expect(screen.queryByTestId(TEST_IDS.chatSendButton)).toBeNull();
  });

  it('shows the send button after typing when enabled', () => {
    renderInput();

    fireEvent.change(screen.getByTestId(TEST_IDS.chatMessageInput), { target: { value: 'hello' } });

    expect(screen.getByTestId(TEST_IDS.chatSendButton)).toBeInTheDocument();
  });

  it('marks the reply card with the reply composer test id', () => {
    renderInput({
      preview: { testId: TEST_IDS.chatReplyComposer, title: 'Reply to Alice', text: 'the original', onClose: vi.fn() },
    });

    expect(screen.getByText('the original').closest(`[data-testid="${TEST_IDS.chatReplyComposer}"]`)).not.toBeNull();
  });

  describe('send in flight', () => {
    // A send that never settles — the invitation case from issue #873. Handed in as a
    // prop rather than mocked: the seam is already there.
    const neverSettles = () => new Promise<void>(() => {});

    const type = (value: string) => fireEvent.change(screen.getByTestId(TEST_IDS.chatMessageInput), { target: { value } });

    it('keeps the send button mounted, disabled and busy while opted in', async () => {
      renderInput({ showSendProgress: true, submitAction: neverSettles });

      type('hello');
      fireEvent.click(screen.getByTestId(TEST_IDS.chatSendButton));

      await waitFor(() => expect(screen.getByTestId(TEST_IDS.chatSendButton)).toBeDisabled());

      const button = screen.getByTestId(TEST_IDS.chatSendButton);
      expect(button).toHaveAttribute('aria-busy', 'true');
      // The spinner replaces the arrow, so the button reads as working rather than as a
      // dead control the user could keep pressing.
      expect(button.querySelector('.animate-spin')).not.toBeNull();
    });

    it('leaves the other composers unchanged — the button still unmounts without the opt-in', async () => {
      renderInput({ submitAction: neverSettles });

      type('hello');
      fireEvent.click(screen.getByTestId(TEST_IDS.chatSendButton));

      await waitFor(() => expect(screen.queryByTestId(TEST_IDS.chatSendButton)).toBeNull());
    });
  });
});
