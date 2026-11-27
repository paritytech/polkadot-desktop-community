import { type ReactNode } from 'react';

import ChevronRightIcon from '@/shared/assets/images/icons/chevron-right.svg?jsx';
import { cnTw } from '@/shared/utils';

// `icon`, `description` and `meta` render inside spans (and, in the button shape, inside a <button>): pass phrasing
// content only. A description with several lines wraps each line's pieces in one <span>; every top-level element of
// the node becomes its own truncated line.
type Props = {
  icon?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  chevron?: boolean;
  action?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: VoidFunction;
  testId?: string;
};

type TextColumnProps = {
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

const TextColumn = ({ label, description, disabled }: TextColumnProps) => (
  <span className="flex min-w-0 flex-1 flex-col">
    <span className={cnTw('truncate text-sm font-semibold text-chrome-text', disabled && 'text-chrome-faint')}>{label}</span>
    {description ? (
      <span
        className={cnTw('min-w-0 truncate text-xs text-chrome-muted [&>*]:block [&>*]:truncate', disabled && 'text-chrome-faint')}
      >
        {description}
      </span>
    ) : null}
  </span>
);

// With an action the row cannot be one <button> (no button nests in a button): the main button stretches over the row
// through its ::after, and the action box is positioned so it paints above that overlay and keeps its own clicks.
export const ListItem = ({
  icon,
  label,
  description,
  meta,
  chevron,
  action,
  selected,
  disabled,
  title,
  onClick,
  testId,
}: Props) => {
  const leading = icon ? (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl [&>svg]:size-5 [&>svg]:text-chrome-muted">
      {icon}
    </span>
  ) : null;
  const text = <TextColumn label={label} description={description} disabled={disabled} />;
  const trailing = (
    <>
      {meta ? <span className="shrink-0 text-xs text-chrome-muted">{meta}</span> : null}
      {chevron ? <ChevronRightIcon className="size-4 shrink-0 text-chrome-muted rtl:-scale-x-100" /> : null}
    </>
  );

  if (onClick && !action) {
    return (
      <button
        type="button"
        data-testid={testId}
        title={title}
        disabled={disabled}
        aria-current={selected ? 'true' : undefined}
        data-no-app-focus
        style={{ appRegion: 'no-drag' }}
        className={cnTw(
          'relative flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-chrome-focus',
          !disabled && 'hover:bg-chrome-fill',
          selected && 'bg-chrome-fill',
        )}
        onClick={onClick}
      >
        {leading}
        {text}
        {trailing}
      </button>
    );
  }

  return (
    <div
      data-testid={testId}
      title={title}
      className={cnTw(
        'relative flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start',
        onClick && !disabled && 'hover:bg-chrome-fill',
        selected && 'bg-chrome-fill',
      )}
    >
      {leading}
      {onClick ? (
        <button
          type="button"
          disabled={disabled}
          aria-current={selected ? 'true' : undefined}
          data-no-app-focus
          style={{ appRegion: 'no-drag' }}
          className="flex min-w-0 flex-1 text-start outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-chrome-focus"
          onClick={onClick}
        >
          {text}
        </button>
      ) : (
        text
      )}
      {trailing}
      {action ? <span className="relative flex shrink-0">{action}</span> : null}
    </div>
  );
};
