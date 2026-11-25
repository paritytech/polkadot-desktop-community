// @vitest-environment happy-dom

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { CopyButton } from './CopyButton';

// `userEvent.setup()` swaps `navigator.clipboard` for its own stub, so each test spies on
// `writeText` only after setting up its user.
function stubClipboardWrite(result: 'resolves' | 'rejects') {
  return vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockImplementation(() => (result === 'resolves' ? Promise.resolve() : Promise.reject(new Error('denied'))));
}

function renderCopyButton(disabled?: boolean) {
  return render(
    <TranslationProvider>
      <CopyButton disabled={disabled} label="Copy address" value="0xabc" />
    </TranslationProvider>,
  );
}

function setupWithFakeTimers() {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe('CopyButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('copies the value and says so', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboardWrite('resolves');
    renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));

    expect(writeText).toHaveBeenCalledWith('0xabc');
    await screen.findByRole('button', { name: 'Copied' });
  });

  it('says when the copy failed', async () => {
    const user = userEvent.setup();
    stubClipboardWrite('rejects');
    renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));

    await screen.findByRole('button', { name: 'Copy failed' });
  });

  it('returns to its label after 1200 ms', async () => {
    const user = setupWithFakeTimers();
    stubClipboardWrite('resolves');
    renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));
    await screen.findByRole('button', { name: 'Copied' });

    act(() => vi.advanceTimersByTime(1200));

    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
  });

  it('returns to its label after 1200 ms when the copy failed', async () => {
    const user = setupWithFakeTimers();
    stubClipboardWrite('rejects');
    renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));
    await screen.findByRole('button', { name: 'Copy failed' });

    act(() => vi.advanceTimersByTime(1200));

    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
  });

  it('leaves no pending timer after unmounting during the feedback', async () => {
    const user = setupWithFakeTimers();
    stubClipboardWrite('resolves');
    const { unmount } = renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));
    await screen.findByRole('button', { name: 'Copied' });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts the 1200 ms on a second press', async () => {
    const user = setupWithFakeTimers();
    const writeText = stubClipboardWrite('resolves');
    renderCopyButton();

    await user.click(screen.getByRole('button', { name: 'Copy address' }));
    await screen.findByRole('button', { name: 'Copied' });
    act(() => vi.advanceTimersByTime(800));

    await user.click(screen.getByRole('button', { name: 'Copied' }));
    act(() => vi.advanceTimersByTime(800));

    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboardWrite('resolves');
    renderCopyButton(true);

    await user.click(screen.getByRole('button', { name: 'Copy address' }));

    expect(writeText).not.toHaveBeenCalled();
  });
});
