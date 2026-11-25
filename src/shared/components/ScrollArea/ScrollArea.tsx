import { type PropsWithChildren } from 'react';

export const ScrollArea = ({ children }: PropsWithChildren) => {
  return <div className="size-full min-h-0 overflow-y-auto overscroll-contain">{children}</div>;
};
