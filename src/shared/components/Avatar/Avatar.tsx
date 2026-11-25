import { cnTw } from '@/shared/utils';

/** Order is load-bearing: chat hashes a name to an index in this list, so reordering changes every contact's colour. */
export const AVATAR_TONES = [
  'amethyst',
  'opal',
  'turquoise',
  'onyx',
  'pearl',
  'emerald',
  'topaz',
  'ruby',
  'sapphire',
  'garnet',
] as const;

export type AvatarTone = (typeof AVATAR_TONES)[number];

type Props = {
  label: string;
  alt?: string;
  tone?: AvatarTone;
  size?: '20' | '40' | '48' | '56';
};

/** A letter avatar: the first letter of `label` on its tone. */
export const Avatar = ({ label, alt, tone = 'amethyst', size = '40' }: Props) => (
  <span
    role="img"
    aria-label={alt ?? label}
    className={cnTw(
      'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold shadow-chrome-line select-none',
      size === '20' && 'size-5 text-xs leading-4',
      size === '40' && 'size-10 text-2xl leading-8',
      size === '48' && 'size-12 text-[1.75rem] leading-9',
      size === '56' && 'size-14 text-2xl leading-8',
      tone === 'amethyst' && 'bg-avatar-bg-amethyst text-avatar-fg-amethyst',
      tone === 'opal' && 'bg-avatar-bg-opal text-avatar-fg-opal',
      tone === 'turquoise' && 'bg-avatar-bg-turquoise text-avatar-fg-turquoise',
      tone === 'onyx' && 'bg-avatar-bg-onyx text-avatar-fg-onyx',
      tone === 'pearl' && 'bg-avatar-bg-pearl text-avatar-fg-pearl',
      tone === 'emerald' && 'bg-avatar-bg-emerald text-avatar-fg-emerald',
      tone === 'topaz' && 'bg-avatar-bg-topaz text-avatar-fg-topaz',
      tone === 'ruby' && 'bg-avatar-bg-ruby text-avatar-fg-ruby',
      tone === 'sapphire' && 'bg-avatar-bg-sapphire text-avatar-fg-sapphire',
      tone === 'garnet' && 'bg-avatar-bg-garnet text-avatar-fg-garnet',
    )}
  >
    {label.trim().charAt(0).toLocaleUpperCase() || '?'}
  </span>
);
