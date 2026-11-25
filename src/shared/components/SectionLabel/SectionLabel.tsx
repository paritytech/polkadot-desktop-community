import { type PropsWithChildren } from 'react';

/** dot.li's section label: a group's caps heading. */
export const SectionLabel = ({ children }: PropsWithChildren) => (
  <h2 className="px-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-chrome-muted uppercase">{children}</h2>
);
