import { type ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  onClick: VoidFunction;
};

export const ListItem = ({ icon, label, description, onClick }: Props) => (
  <button
    type="button"
    data-no-app-focus
    style={{ appRegion: 'no-drag' }}
    className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-chrome-well p-3 text-start shadow-chrome-line transition-shadow duration-150 hover:shadow-chrome-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus motion-reduce:transition-none"
    onClick={onClick}
  >
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chrome-fill">{icon}</span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm text-chrome-text">{label}</span>
      {description && <span className="truncate text-xs text-chrome-muted">{description}</span>}
    </span>
  </button>
);
