import { type PropsWithChildren } from 'react';

export const Badge = ({ children }: PropsWithChildren) => {
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-chrome-fill px-2 text-xs font-semibold tracking-[0.08em] whitespace-nowrap text-chrome-text uppercase shadow-chrome-ring">
      {children}
    </span>
  );
};
