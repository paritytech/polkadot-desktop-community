import { type PermissionStatus } from '@/domains/product';

export type PermissionDecision = 'deny' | 'allow-once' | 'allow-always' | 'dismiss';

export function getPersistedPermissionStatus(decision: PermissionDecision): PermissionStatus | null {
  if (decision === 'allow-once') return 'ask';
  if (decision === 'allow-always') return 'granted';
  if (decision === 'deny') return 'denied';
  return null;
}
