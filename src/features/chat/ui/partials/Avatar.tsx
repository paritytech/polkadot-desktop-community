import { type ComponentProps } from 'react';

import { Avatar as SharedAvatar } from '@/shared/components';
import { getAvatarTone } from '../helpers/avatar';

type AvatarProps = {
  name: string;
  size?: ComponentProps<typeof SharedAvatar>['size'];
};

export const Avatar = ({ name, size = '40' }: AvatarProps) => (
  <SharedAvatar label={name} alt={name} tone={getAvatarTone(name)} size={size} />
);
