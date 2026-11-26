import { cnTw } from '@/shared/utils';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
};

export const Switch = ({ checked, onCheckedChange, label }: SwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-no-app-focus
      style={{ appRegion: 'no-drag' }}
      className={cnTw(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-[background-color] duration-150 before:absolute before:-inset-1 after:block after:size-4 after:rounded-full after:shadow-chrome-knob after:[transition:translate_260ms_cubic-bezier(0.2,0.9,0.25,1.08),background-color_150ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chrome-focus motion-reduce:transition-none motion-reduce:after:transition-none',
        checked && 'bg-chrome-text after:translate-x-4 after:bg-chrome-on-primary rtl:after:-translate-x-4',
        !checked && 'bg-chrome-switch-track shadow-chrome-ring after:bg-chrome-knob',
      )}
      onClick={() => onCheckedChange(!checked)}
    />
  );
};
