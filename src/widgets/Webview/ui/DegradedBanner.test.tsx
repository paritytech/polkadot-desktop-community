// @vitest-environment happy-dom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { DegradedBanner } from './DegradedBanner';

function renderBanner(props: Partial<React.ComponentProps<typeof DegradedBanner>> = {}) {
  const onReload = props.onReload ?? vi.fn();
  return render(
    <TranslationProvider>
      <DegradedBanner reason={{ kind: 'heartbeat-rtt-high' }} onReload={onReload} {...props} />
    </TranslationProvider>,
  );
}

describe('DegradedBanner', () => {
  it('renders reload button', () => {
    const { getByTestId } = renderBanner();
    expect(getByTestId('degraded-banner-reload')).toBeTruthy();
  });

  it('calls onReload when reload clicked', () => {
    const onReload = vi.fn();
    const { getByTestId } = renderBanner({ onReload });
    fireEvent.click(getByTestId('degraded-banner-reload'));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('is dismissible per-session', () => {
    const { getByTestId, queryByTestId } = renderBanner();
    fireEvent.click(getByTestId('degraded-banner-dismiss'));
    expect(queryByTestId('degraded-banner-reload')).toBeNull();
  });
});
