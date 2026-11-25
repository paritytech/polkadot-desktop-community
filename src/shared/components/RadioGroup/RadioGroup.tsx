import { type PropsWithChildren, type ReactNode, createContext, useContext, useId, useMemo } from 'react';

import { cnTw } from '@/shared/utils';

type RadioGroupContextValue = {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
};

const RadioGroupContext = createContext<Nullable<RadioGroupContextValue>>(null);

type RadioGroupRootProps = PropsWithChildren<{
  /** The group's accessible name. */
  label: string;
  /** The checked item's value; a value no item has checks none. */
  value: string;
  /** Called with the picked item's value; the group shows `value` until its owner changes it. */
  onValueChange: (value: string) => void;
}>;

const RadioGroupRoot = ({ label, value, onValueChange, children }: RadioGroupRootProps) => {
  const name = useId();
  const context = useMemo(() => ({ name, value, onValueChange }), [name, value, onValueChange]);

  return (
    <RadioGroupContext.Provider value={context}>
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
};

type RadioGroupItemProps = {
  value: string;
  title: ReactNode;
  description?: ReactNode;
};

const RadioGroupItem = ({ value, title, description }: RadioGroupItemProps) => {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error('RadioGroup.Item must be rendered inside RadioGroup.Root');
  }

  const checked = context.value === value;
  const titleId = useId();
  const descriptionId = useId();

  return (
    <label
      style={{ appRegion: 'no-drag' }}
      className={cnTw(
        'relative flex w-full cursor-pointer items-start gap-2 rounded-xl bg-chrome-well px-3 py-2 text-start text-chrome-text transition-shadow duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-chrome-focus motion-reduce:transition-none',
        checked && 'shadow-chrome-selected',
        !checked && 'shadow-chrome-line hover:shadow-chrome-ring',
      )}
    >
      <input
        type="radio"
        className="sr-only"
        name={context.name}
        value={value}
        checked={checked}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        data-no-app-focus
        onChange={() => context.onValueChange(value)}
      />
      <span
        aria-hidden
        className={cnTw(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
          checked && 'bg-chrome-text',
          !checked && 'inset-ring-2 inset-ring-chrome-muted',
        )}
      >
        {checked && <span className="size-1.5 rounded-full bg-chrome-on-primary" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span id={titleId} className="text-sm font-semibold">
          {title}
        </span>
        {description && (
          <span id={descriptionId} className="text-xs text-chrome-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
};

/**
 * dot.li's choice cards: one option out of a few, each a card with a title and an optional description. Native radios
 * underneath make the group one Tab stop with arrow-key selection.
 */
export const RadioGroup = {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
};
