// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { RequestBanner } from './RequestBanner';

const renderBanner = (props: Partial<Parameters<typeof RequestBanner>[0]> = {}) =>
  render(
    <TranslationProvider>
      <RequestBanner
        name="mysticRiver.88"
        placement={props.placement ?? 'top'}
        onAccept={props.onAccept ?? vi.fn()}
        onDecline={props.onDecline ?? vi.fn()}
        {...props}
      />
    </TranslationProvider>,
  );

describe('RequestBanner', () => {
  it('renders the peer name and both actions', () => {
    renderBanner();

    expect(screen.getByText('mysticRiver.88')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('fires onAccept and onDecline', async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    renderBanner({ onAccept, onDecline });

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('puts the accept test id on the Accept button itself', () => {
    renderBanner({ acceptTestId: 'accept' });

    expect(screen.getByTestId('accept')).toBe(screen.getByRole('button', { name: 'Accept' }));
  });

  it('disables actions when disabled', () => {
    renderBanner({ disabled: true });

    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  });
});
