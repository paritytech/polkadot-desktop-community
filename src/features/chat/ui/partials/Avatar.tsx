import { cnTw } from '@/shared/utils';
import { type AvatarSize, getAvatarLetter, getAvatarPalette } from '../helpers/avatar';

type AvatarProps = {
  name: string;
  size?: AvatarSize;
};

export const Avatar = ({ name, size = 'medium' }: AvatarProps) => {
  const letter = getAvatarLetter(name);
  const palette = getAvatarPalette(name);

  return (
    <div
      className={cnTw('shrink-0 overflow-hidden rounded-full select-none', {
        'size-5': size === 'tiny',
        'size-12': size === 'medium',
        'size-14': size === 'big',
        'size-10': size === 'chat-header',
        'size-16': size === 'chat-list',
      })}
      style={{ backgroundColor: palette.bg }}
    >
      <div
        className={cnTw('flex size-full items-center justify-center', {
          'text-xs font-medium': size === 'tiny',
          'text-base font-semibold': size === 'medium',
          'text-2xl font-semibold': size === 'chat-header',
          'text-[30px] font-semibold': size === 'big',
          'text-[28px] leading-9 font-semibold': size === 'chat-list',
        })}
        style={{ color: palette.fg }}
      >
        {letter}
      </div>
    </div>
  );
};
