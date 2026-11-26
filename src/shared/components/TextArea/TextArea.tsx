import { type ComponentProps, type MouseEvent, type ReactNode, useLayoutEffect, useRef } from 'react';

type TextAreaProps = Omit<ComponentProps<'textarea'>, 'className'> & {
  header?: ReactNode;
  trailing?: ReactNode;
  /** The field grows with its content up to this many lines, then scrolls. */
  maxRows?: number;
};

// The row owns the padding around a one-line textarea, so a press there would otherwise land on a non-focusable box.
// The header sits outside the row, and a trailing control is neither the row nor the text box, so both keep their press.
const focusField = (event: MouseEvent<HTMLDivElement>) => {
  const field = event.currentTarget.querySelector('textarea');
  if (!field || (event.target !== event.currentTarget && event.target !== field.parentElement)) {
    return;
  }

  event.preventDefault();
  field.focus();
};

// Resetting the height to `auto` first lets `scrollHeight` shrink back when text is removed. Overflow stays hidden until
// the cap, because `auto` on a field that fits still reserves a scrollbar track in some engines.
const fitToContent = (field: HTMLTextAreaElement, maxRows: number) => {
  const maxHeight = maxRows * parseFloat(getComputedStyle(field).lineHeight);
  field.style.height = 'auto';
  field.style.height = `${Math.min(field.scrollHeight, maxHeight)}px`;
  field.style.overflowY = field.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

export const TextArea = ({ ref, header, trailing, maxRows = 5, value, style, onInput, ...rest }: TextAreaProps) => {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  // A controlled value can change without an input event (a send clears it, an edit seeds it), so the size follows
  // `value` too; a layout effect measures before paint, so the height never flickers.
  useLayoutEffect(() => {
    if (fieldRef.current) fitToContent(fieldRef.current, maxRows);
  }, [value, maxRows]);

  return (
    <div
      style={{ appRegion: 'no-drag' }}
      className="flex w-full flex-col rounded-3xl bg-chrome-well shadow-chrome-inset has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-0 has-[textarea:focus-visible]:outline-chrome-focus"
    >
      {header}
      <div className="flex min-h-12 items-end gap-2 py-2 ps-4 pe-2" onMouseDown={focusField}>
        <div className="flex min-h-8 flex-1 items-center">
          <textarea
            rows={1}
            {...rest}
            ref={field => {
              fieldRef.current = field;
              if (typeof ref === 'function') ref(field);
              else if (ref) ref.current = field;
            }}
            value={value}
            className="w-full resize-none overflow-y-hidden bg-transparent text-base text-chrome-text outline-none placeholder:text-chrome-muted disabled:cursor-default disabled:text-chrome-faint"
            style={{ appRegion: 'no-drag', ...style }}
            data-no-app-focus
            onInput={event => {
              fitToContent(event.currentTarget, maxRows);
              onInput?.(event);
            }}
          />
        </div>
        {trailing}
      </div>
    </div>
  );
};
