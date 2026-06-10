import { type DashboardCardLayoutRules } from '@/domains/application';

export const CHAT_CARD_KIND = 'native:chat';

export const CHAT_CARD_LAYOUT_RULES: DashboardCardLayoutRules = {
  minH: 2,
  minW: 1,
  maxW: 1,
  menuSizes: ['small', 'medium', 'large'],
  availableSizes: ['ICON', 'HALF', 'FULL'],
  defaultSize: 'HALF',
};
