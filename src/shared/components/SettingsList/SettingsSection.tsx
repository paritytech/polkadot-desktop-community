import { type PropsWithChildren, type ReactNode } from 'react';

import { cnTw } from '@/shared/utils';
import { SectionLabel } from '../SectionLabel/SectionLabel';

type Props = PropsWithChildren<{
  title?: ReactNode;
  layout?: 'plain' | 'list';
}>;

export const SettingsSection = ({ title, layout = 'plain', children }: Props) => {
  return (
    <section className="flex flex-col gap-1.5">
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <div
        className={cnTw('rounded-xl bg-chrome-well shadow-chrome-inset', layout === 'plain' && 'p-3', layout === 'list' && 'p-1')}
      >
        {children}
      </div>
    </section>
  );
};
