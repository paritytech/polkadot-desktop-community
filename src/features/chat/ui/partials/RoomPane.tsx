import { type FC, type PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  testId?: string;
}>;

export const RoomPane: FC<Props> = ({ testId, children }) => (
  <div data-testid={testId} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-bg-surface-container">
    {children}
  </div>
);
