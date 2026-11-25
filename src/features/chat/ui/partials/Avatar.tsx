import { Avatar as SharedAvatar } from '@/shared/components';
import { type AvatarSize, avatarSizeMap, getAvatarTone } from '../helpers/avatar';

type AvatarProps = {
  name: string;
  size?: AvatarSize;
};

export const Avatar = ({ name, size = 'medium' }: AvatarProps) => (
  <SharedAvatar label={name} alt={name} tone={getAvatarTone(name)} size={avatarSizeMap[size]} />
);
