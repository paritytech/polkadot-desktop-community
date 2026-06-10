// This is the only one place of import.
// eslint-disable-next-line no-restricted-imports
import cn from 'classnames';
import { extendTailwindMerge } from 'tailwind-merge';

type CnArgs = Parameters<typeof cn>;

const twMerge = extendTailwindMerge({
  cacheSize: 10_000,
});

/**
 * Merge CSS classes use Tailwind Merge internally to overcome Tailwind styling
 * cascade
 *
 * @param args List of arguments for <b>cn</b>
 *
 * @returns {String}
 */
export const cnTw = (...args: CnArgs): string => twMerge(cn(args));

export const tw = (strings: TemplateStringsArray, ...values: unknown[]) => String.raw({ raw: strings }, ...values);
