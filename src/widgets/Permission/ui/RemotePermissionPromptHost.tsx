import { useEffect, useRef, useState } from 'react';
import { useSyncObservable } from 'react-rx';

import { toast } from '@/shared/components';
import { useLooseRef } from '@/shared/hooks';
import { useTranslation } from '@/shared/translation';
import {
  type PendingRemotePermissionRequest,
  type PermissionStatus,
  pendingRemotePermissionRequests$,
  permissionsService,
  useSetPermissionStatus,
} from '@/domains/product';

import { RemotePermissionRequestDialog } from './RemotePermissionRequestDialog';

type Decision = 'allow-always' | 'allow-once' | 'deny' | 'dismiss';

const DECISION_EFFECTS: Record<Decision, { persist: PermissionStatus | null; toast: boolean; status: PermissionStatus }> = {
  'allow-always': { persist: 'granted', toast: false, status: 'granted' },
  'allow-once': { persist: null, toast: false, status: 'granted' },
  deny: { persist: 'denied', toast: true, status: 'denied' },
  dismiss: { persist: null, toast: true, status: 'denied' },
};

// Advance fallback for environments that don't fire CSS `animationend`
// (jsdom/happy-dom, OS reduce-motion, broken styles). Must exceed the
// dialog's exit animation (`animate-dialog-out`, 150ms in `chrome.css`) so the animation-driven
// path wins in real browsers; 500ms gives generous slack.
const EXIT_FALLBACK_MS = 500;

export const RemotePermissionPromptHost = () => {
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const setStatus = useSetPermissionStatus();
  const setStatusRef = useLooseRef(setStatus);

  const pending = useSyncObservable(pendingRemotePermissionRequests$, []);
  const head = pending[0] ?? null;

  const [shown, setShown] = useState<PendingRemotePermissionRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const finalStatusRef = useRef<PermissionStatus | null>(null);
  const advanceRef = useRef<VoidFunction | null>(null);

  useEffect(() => {
    if (shown || !head) return;
    setShown(head);
    setIsOpen(true);
  }, [shown, head]);

  // Advance when the dialog fully exits — whichever fires first wins.
  useEffect(() => {
    if (isOpen || !shown) return;

    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      advanceRef.current = null;
      const status = finalStatusRef.current ?? 'denied';
      const req = shown;
      finalStatusRef.current = null;
      setShown(null);
      req.resolve(status);
    };

    advanceRef.current = advance;
    const timer = window.setTimeout(advance, EXIT_FALLBACK_MS);
    return () => {
      window.clearTimeout(timer);
      advanceRef.current = null;
    };
  }, [isOpen, shown]);

  const handleDecision = (decision: Decision) => {
    if (!shown || finalStatusRef.current) return;
    const effect = DECISION_EFFECTS[decision];

    if (effect.persist) {
      // `toAuthorizationRequest` reduces the origin to the bare host the core keys on,
      // the same normalization the enforcement read applies, so a persisted grant is a
      // key its own lookup can match.
      const request = permissionsService.toAuthorizationRequest('ExternalRequest', { pattern: shown.origin });
      if (request) {
        setStatusRef().run({ productId: shown.productId, request, status: effect.persist });
      }
    }
    if (effect.toast) {
      toast.error({ title: tRef()('feature.productPermissions.externalBlockedToast', { origin: shown.origin }) });
    }

    finalStatusRef.current = effect.status;
    setIsOpen(false);
  };

  if (!shown) return null;

  return (
    <RemotePermissionRequestDialog
      key={shown.origin}
      isOpen={isOpen}
      productId={shown.productId}
      permission="Remote"
      values={[shown.origin]}
      onAllowAlways={() => handleDecision('allow-always')}
      onAllowOnce={() => handleDecision('allow-once')}
      onDeny={() => handleDecision('deny')}
      onDismiss={() => handleDecision('dismiss')}
      onExited={() => advanceRef.current?.()}
    />
  );
};
