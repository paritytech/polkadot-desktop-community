import { type FC, type PropsWithChildren } from 'react';

export const RoomPane: FC<PropsWithChildren> = ({ children }) => (
  <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-bg-surface-container">{children}</div>
);
