import { ChevronLeft, ChevronRight } from 'lucide-react';

import { HeaderButton } from '../HeaderButton/HeaderButton';

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
      <HeaderButton variant="icon" testId={backTestId} ariaLabel={backAriaLabel} disabled={!canGoBack} onClick={goBack}>
        <ChevronLeft size={16} aria-hidden />
      </HeaderButton>
      <HeaderButton
        variant="icon"
        testId={forwardTestId}
        ariaLabel={forwardAriaLabel}
        disabled={!canGoForward}
        onClick={goForward}
      >
        <ChevronRight size={16} aria-hidden />
      </HeaderButton>
    </div>
  );
};
