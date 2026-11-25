import { Button } from '../Button/Button';

type WidgetPlaceholderProps = {
  message: string;
  actionLabel?: string;
  onAction?: VoidFunction;
  testId?: string;
};

export const WidgetPlaceholder = ({ message, actionLabel, onAction, testId }: WidgetPlaceholderProps) => {
  return (
    <div data-testid={testId} className="flex h-full w-full items-center justify-center px-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-xs leading-4 whitespace-nowrap text-fg-secondary">{message}</p>
        {actionLabel && onAction ? (
          <Button variant="ghost" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
