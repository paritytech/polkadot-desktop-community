import { useTabRouteBinding } from '@/aggregates/browser-tabs';
import { CHAT } from '../tabs';

const chatTab = { id: CHAT, type: CHAT, deeplink: '' };

export const ChatTabBinding = () => {
  useTabRouteBinding({ segment: '/chat', tab: chatTab, touchAlive: true });

  return null;
};
