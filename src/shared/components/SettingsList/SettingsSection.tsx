import { type PropsWithChildren, type ReactNode } from 'react';

import { SectionLabel } from '../SectionLabel/SectionLabel';

type Props = PropsWithChildren<{
  title?: ReactNode;
}>;

export const SettingsSection = ({ title, children }: Props) => {
  return (
    <section className="flex flex-col gap-1.5">
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <div className="rounded-xl bg-chrome-well p-3 shadow-chrome-inset">{children}</div>
    </section>
  );
};
