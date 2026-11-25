import { type ComponentProps } from 'react';

import { type Avatar, type AvatarTone, AVATAR_TONES } from '@/shared/components';

// Semantic sizes used across the chat UI, mapped to the avatar's pixel sizes. `chat-list` is a 64px design size the
// avatar does not have, so it maps to the nearest, 56.
export type AvatarSize = 'tiny' | 'medium' | 'big' | 'chat-header' | 'chat-list' | 'chat-list-compact';

export const avatarSizeMap: Record<AvatarSize, NonNullable<ComponentProps<typeof Avatar>['size']>> = {
  tiny: '20',
  'chat-header': '40',
  medium: '48',
  'chat-list-compact': '48',
  big: '56',
  'chat-list': '56',
};

// Stable name → tone so the same contact always gets the same avatar colour.
export function getAvatarTone(name: string): AvatarTone {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'amethyst';
}
