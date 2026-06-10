export type AliasPermissionDecision = 'deny' | 'allow-once' | 'allow-always' | 'dismiss';
export type AliasPermissionEffect = 'reject' | 'allow-once' | 'persist-granted' | 'persist-denied';

export function decideAliasPermissionEffect(decision: AliasPermissionDecision): AliasPermissionEffect {
  if (decision === 'allow-once') return 'allow-once';
  if (decision === 'allow-always') return 'persist-granted';
  if (decision === 'deny') return 'persist-denied';
  return 'reject';
}
