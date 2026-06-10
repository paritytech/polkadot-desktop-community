// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TranslationProvider } from '@/shared/translation';

import { CrashOverlay } from './CrashOverlay';

const crash = { webContentsId: 7, url: 'polkadot://app.dot/', reason: 'oom', exitCode: 5, at: 1700000000000 };

const wrapper = ({ children }: { children: React.ReactNode }) => <TranslationProvider>{children}</TranslationProvider>;

describe('CrashOverlay', () => {
  it('renders the title', () => {
    render(<CrashOverlay crash={crash} onReload={vi.fn()} />, { wrapper });
    expect(screen.getByRole('heading')).toBeDefined();
  });

  it('calls onReload when the Reload button is clicked', () => {
    const onReload = vi.fn();
    render(<CrashOverlay crash={crash} onReload={onReload} />, { wrapper });
    fireEvent.click(screen.getByTestId('crash-overlay-reload'));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('shows details section with reason and exitCode', () => {
    render(<CrashOverlay crash={crash} onReload={vi.fn()} />, { wrapper });
    expect(screen.getByTestId('crash-overlay-details').textContent).toMatch(/oom/);
    expect(screen.getByTestId('crash-overlay-details').textContent).toMatch(/5/);
  });
});
