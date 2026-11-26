import { type AvatarTone, AVATAR_TONES } from '@/shared/components';

// Stable name → tone so the same contact always gets the same avatar colour.
export function getAvatarTone(name: string): AvatarTone {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? 'amethyst';
}
