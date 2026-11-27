import CheckIcon from '@/shared/assets/images/icons/check.svg?jsx';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';
import { THEME_NAMES, useSetThemeName, useThemeName } from '@/domains/application';
import { THEME_SWATCHES } from '../constants';

export const ThemePicker = () => {
  const { t } = useTranslation();
  const active = useThemeName();
  const { run: setName } = useSetThemeName();

  return (
    <div role="radiogroup" className="flex gap-4">
      {THEME_NAMES.map(name => {
        const selected = active === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`feature.themeToggle.${name}`)}
            className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl focus-visible:outline-none"
            onClick={() => setName(name)}
          >
            <span
              className={cnTw(
                'flex h-22 w-full items-center justify-center rounded-2xl bg-bg-surface-nested transition-all',
                'group-focus-visible:ring-2 group-focus-visible:ring-focus-ring/50',
                selected
                  ? 'ring-1 ring-stroke-tertiary ring-offset-2 ring-offset-bg-surface-main'
                  : 'ring-1 ring-transparent hover:ring-stroke-secondary',
              )}
            >
              <span aria-hidden className="relative flex size-12 overflow-hidden rounded-full">
                <span className="h-full flex-1" style={{ backgroundColor: THEME_SWATCHES[name].light }} />
                <span className="h-full flex-1" style={{ backgroundColor: THEME_SWATCHES[name].dark }} />
                <span className="absolute inset-0 rounded-full shadow-chrome-ring" />
                {selected && (
                  <span className="absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-chrome-top text-chrome-text shadow-chrome-ring">
                    <CheckIcon className="size-4" />
                  </span>
                )}
              </span>
            </span>
            <span className={cnTw('text-sm font-medium', selected ? 'text-fg-primary' : 'text-fg-secondary')}>
              {t(`feature.themeToggle.${name}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
};
