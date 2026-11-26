import { type ComponentProps, type ReactNode } from 'react';

type TextAreaProps = Omit<ComponentProps<'textarea'>, 'className'> & {
  header?: ReactNode;
  trailing?: ReactNode;
};

export const TextArea = ({ header, trailing, style, ...rest }: TextAreaProps) => (
  <div className="flex w-full flex-col rounded-3xl bg-chrome-well shadow-chrome-inset has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-0 has-[textarea:focus-visible]:outline-chrome-focus">
    {header}
    <div className="flex min-h-12 items-end gap-2 py-2 ps-4 pe-2">
      <div className="flex min-h-8 flex-1 items-center">
        <textarea
          rows={1}
          {...rest}
          className="w-full resize-none bg-transparent text-base text-chrome-text outline-none placeholder:text-chrome-muted disabled:cursor-default disabled:text-chrome-faint"
          style={{ appRegion: 'no-drag', ...style }}
          data-no-app-focus
        />
      </div>
      {trailing}
    </div>
  </div>
);
