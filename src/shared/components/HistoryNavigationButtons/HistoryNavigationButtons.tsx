import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type Props = {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: VoidFunction;
  goForward: VoidFunction;
  backAriaLabel: string;
  forwardAriaLabel: string;
  backTestId?: string;
  forwardTestId?: string;
};

export const HistoryNavigationButtons = ({
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  backAriaLabel,
  forwardAriaLabel,
  backTestId,
  forwardTestId,
}: Props) => {
  return (
    <div className="flex items-center gap-1">
      <NavigationButton testId={backTestId} ariaLabel={backAriaLabel} disabled={!canGoBack} onClick={goBack}>
        <ChevronLeft size={16} />
      </NavigationButton>
      <NavigationButton testId={forwardTestId} ariaLabel={forwardAriaLabel} disabled={!canGoForward} onClick={goForward}>
        <ChevronRight size={16} />
      </NavigationButton>
    </div>
  );
};

type NavigationButtonProps = {
  testId?: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: VoidFunction;
  children: ReactNode;
};

const NavigationButton = ({ testId, ariaLabel, disabled, onClick, children }: NavigationButtonProps) => {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cnTw(
        'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-transparent transition-colors',
        disabled
          ? 'cursor-default text-text-tertiary opacity-50'
          : 'cursor-pointer text-text-secondary hover:bg-bg-action-secondary-hover',
      )}
      style={{ appRegion: 'no-drag' }}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
