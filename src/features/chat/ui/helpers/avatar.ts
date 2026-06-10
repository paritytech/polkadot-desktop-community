export type AvatarSize = 'tiny' | 'medium' | 'big' | 'chat-header' | 'chat-list';

export type AvatarColor = (typeof avatarColorsList)[number];
export const avatarColorsList = ['amethyst', 'turquoise', 'emerald', 'opal', 'onyx', 'amber'] as const;

export type AvatarPalette = { bg: string; fg: string };

export const avatarPalettes: Record<AvatarColor, AvatarPalette> = {
  amethyst: { bg: '#f0efff', fg: '#7365ff' },
  turquoise: { bg: '#dbf5ff', fg: '#008aa1' },
  emerald: { bg: '#c6ffea', fg: '#036843' },
  opal: { bg: '#ffd0f3', fg: '#c600aa' },
  onyx: { bg: '#f2efff', fg: '#9462fa' },
  amber: { bg: '#fff3c6', fg: '#956104' },
};

export function getAvatarColor(name: string): AvatarColor {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColorsList[hash % avatarColorsList.length] ?? 'amethyst';
}

export function getAvatarPalette(name: string): AvatarPalette {
  return avatarPalettes[getAvatarColor(name)];
}

export function getAvatarLetter(name: string) {
  return name.at(0)?.toUpperCase() ?? '?';
}
