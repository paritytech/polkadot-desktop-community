import { ScrollArea } from '@novasamatech/tr-ui';
import { type PropsWithChildren, type ReactNode } from 'react';

import { SettingsHeader } from './SettingsHeader';

type Props = PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: VoidFunction;
}>;

export const SettingsList = ({ title, subtitle, onBack, children }: Props) => {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex w-full flex-col items-center bg-bg-surface-container">
        <div className="w-150 max-w-full">
          <SettingsHeader subtitle={subtitle} onBack={onBack}>
            {title}
          </SettingsHeader>
        </div>
      </div>
      <div className="min-h-0 shrink">
        <ScrollArea>
          <div className="flex min-h-0 flex-col items-center">
            <div className="flex min-h-0 w-150 max-w-full flex-col px-4 py-4">{children}</div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
