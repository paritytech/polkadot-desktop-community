// @vitest-environment happy-dom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TEST_IDS } from '@/shared/test-ids';
import { TranslationProvider } from '@/shared/translation';

import { OnboardingConnectionPanel } from './OnboardingConnectionPanel';

type PanelState = 'offline' | 'reaching' | 'restored' | 'accountSetup';

const renderPanel = (state: PanelState, onRetry = vi.fn()) =>
  render(
    <TranslationProvider>
      <OnboardingConnectionPanel state={state} onRetry={onRetry} />
    </TranslationProvider>,
  );

describe('OnboardingConnectionPanel', () => {
  it('renders the offline copy and no retry button', () => {
    const { getByText, queryByTestId } = renderPanel('offline');
    expect(getByText("You're offline")).toBeTruthy();
    expect(queryByTestId(TEST_IDS.onboardingRetryButton)).toBeNull();
  });

  it('renders the reaching copy', () => {
    const { getByText } = renderPanel('reaching');
    expect(getByText('Attempting to reach the node again')).toBeTruthy();
  });

  it('renders account-setup copy with a Retry button that fires onRetry', () => {
    const onRetry = vi.fn();
    const { getByTestId } = renderPanel('accountSetup', onRetry);
    fireEvent.click(getByTestId(TEST_IDS.onboardingRetryButton));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
