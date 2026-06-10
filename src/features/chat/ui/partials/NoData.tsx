import { type ComponentType } from 'react';

type NoDataProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
};

export const NoData = ({ icon: Icon, title, description }: NoDataProps) => {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mb-4 flex max-w-60 flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-bg-surface-nested">
          <Icon className="size-5 text-fg-secondary" />
        </div>
        <span className="text-base leading-6 font-semibold text-fg-primary">{title}</span>
        {description && <span className="text-sm leading-[18px] text-fg-secondary">{description}</span>}
      </div>
    </div>
  );
};
