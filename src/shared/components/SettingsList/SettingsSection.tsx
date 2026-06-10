import { type PropsWithChildren, type ReactNode } from 'react';

type Props = PropsWithChildren<{
  title?: ReactNode;
}>;

export const SettingsSection = ({ title, children }: Props) => {
  return (
    <div className="overflow-hidden rounded-lg border border-general-border bg-surface-foreground">
      {title && (
        <div className="border-b border-general-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};
