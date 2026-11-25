import { type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';

type Props = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  testId?: string;
  className?: string;
};

// Shared centered empty/error/no-results placeholder for the Favorites surfaces
// (the Add-to-Favorites dialog and the fullscreen SPA), so all states share one layout.
export const FavoritesStatePlaceholder = ({ icon, title, description, action, testId, className }: Props) => (
  <div data-testid={testId} className={cnTw('flex min-h-40 flex-1 items-center justify-center px-3 py-10', className)}>
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
