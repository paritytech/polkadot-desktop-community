import { Button } from '@novasamatech/tr-ui';
import { ChevronLeft } from 'lucide-react';
import { type PropsWithChildren, type ReactNode } from 'react';

type Props = PropsWithChildren<{
  icon?: ReactNode;
  subtitle?: ReactNode;
  onBack?: VoidFunction;
}>;

export const SettingsHeader = ({ icon, subtitle, onBack, children }: Props) => (
  <header className="flex min-h-10 w-full shrink-0 items-center gap-2 self-stretch bg-bg-surface-container py-2 ps-4 pe-2 text-fg-primary">
    {onBack ? (
      <Button size="icon-sm" variant="ghost" onClick={onBack}>
        <ChevronLeft />
      </Button>
    ) : null}
    {icon}
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm leading-5 font-semibold">{children}</span>
      {subtitle ? <span className="text-xs leading-4 text-fg-secondary">{subtitle}</span> : null}
    </div>
  </header>
);
