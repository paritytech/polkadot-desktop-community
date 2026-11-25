import { ChevronLeft, ChevronRight } from 'lucide-react';

import { IconButton } from '../IconButton/IconButton';

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
      <IconButton label={backAriaLabel} data-testid={backTestId} disabled={!canGoBack} onClick={goBack}>
        <ChevronLeft size={16} aria-hidden />
      </IconButton>
      <IconButton label={forwardAriaLabel} data-testid={forwardTestId} disabled={!canGoForward} onClick={goForward}>
        <ChevronRight size={16} aria-hidden />
      </IconButton>
    </div>
  );
};
