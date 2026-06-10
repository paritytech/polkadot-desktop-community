import { toastError } from '@novasamatech/tr-ui';
import { useEffect, useRef, useState } from 'react';
import { useObservable } from 'react-rx';

import { useLooseRef } from '@/shared/hooks';
import { useTranslation } from '@/shared/translation';
import {
  type PendingRemotePermissionRequest,
  type PermissionStatus,
  pendingRemotePermissionRequests$,
  useSetRemotePermission,
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
// Radix/tr-ui dialog exit duration so the animation-driven path wins in real
// browsers; the current tr-ui exit lands around 200ms, 500ms gives generous slack.
const EXIT_FALLBACK_MS = 500;

export const RemotePermissionPromptHost = () => {
  const { t } = useTranslation();
  const tRef = useLooseRef(t);
  const setRemote = useSetRemotePermission();
  const setRemoteRef = useLooseRef(setRemote);

  const pending = useObservable(pendingRemotePermissionRequests$, []);
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
      setRemoteRef().run({
        productId: shown.productId,
        permission: { payload: { type: 'Remote', pattern: shown.origin }, modality: shown.modality, status: effect.persist },
      });
    }
    if (effect.toast) {
      toastError({ title: tRef()('feature.productPermissions.externalBlockedToast', { origin: shown.origin }) });
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
