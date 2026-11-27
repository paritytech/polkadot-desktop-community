import { UserRound } from 'lucide-react';

import { cnTw } from '@/shared/utils';

type Props = {
  label: string;
  alt?: string;
  size?: '24' | '40' | '48' | '96' | '136';
};

const graphemes = new Intl.Segmenter();

function leadingGraphemes(word: string, count: number) {
  return Array.from(graphemes.segment(word), ({ segment }) => segment)
    .slice(0, count)
    .join('');
}

function getInitials(label: string): string | undefined {
  const [first, second] = label.split(/\s+/).filter(word => word.length > 0);

  if (first === undefined) {
    return undefined;
  }

  const initials = second === undefined ? leadingGraphemes(first, 2) : leadingGraphemes(first, 1) + leadingGraphemes(second, 1);

  return initials.toLocaleUpperCase();
}

/**
 * An account avatar: up to two initials of `label`, or a person glyph when it has none. The glyph is hidden from
 * assistive tech unless `alt` names it.
 */
export const Avatar = ({ label, alt, size = '40' }: Props) => {
  const initials = getInitials(label);
  const name = initials === undefined ? alt : (alt ?? label);

  return (
    <span
      role={name === undefined ? undefined : 'img'}
      aria-label={name}
      aria-hidden={name === undefined ? true : undefined}
      className={cnTw(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-(image:--chrome-avatar) font-semibold text-chrome-text shadow-chrome-raised select-none',
        size === '24' && 'size-6 text-xs',
        size === '40' && 'size-10 text-lg',
        size === '48' && 'size-12 text-xl',
        size === '96' && 'size-24 text-3xl',
        size === '136' && 'size-34 text-4xl',
      )}
    >
      {initials ?? (
        <UserRound
          className={cnTw(
            size === '24' && 'size-3',
            size === '40' && 'size-4',
            size === '48' && 'size-5',
            size === '96' && 'size-10',
            size === '136' && 'size-14',
          )}
        />
      )}
    </span>
  );
};
