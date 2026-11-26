import { type FC, type ReactNode } from 'react';

type Props = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  testId?: string;
};

export const EmptyState: FC<Props> = ({ icon, title, description, action, testId }) => (
  <div data-testid={testId} className="flex min-h-40 flex-1 items-center justify-center px-3 py-10">
    <div className="flex flex-col items-center gap-2 text-center">
      <div aria-hidden className="mb-1 flex text-chrome-muted [&_svg]:size-7">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-chrome-text">{title}</h3>
      {description ? <p className="text-xs text-chrome-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  </div>
);
