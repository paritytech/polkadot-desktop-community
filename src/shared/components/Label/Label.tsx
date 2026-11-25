import { type PropsWithChildren } from 'react';

type LabelProps = PropsWithChildren<{ htmlFor: string }>;

export const Label = ({ htmlFor, children }: LabelProps) => {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-chrome-muted">
      {children}
    </label>
  );
};
