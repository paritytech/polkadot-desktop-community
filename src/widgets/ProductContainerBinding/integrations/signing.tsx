import { CreateTransactionErr, SigningErr, toHex } from '@novasamatech/host-api';
import { type Container } from '@novasamatech/host-container';
import { useSession } from '@novasamatech/host-papp-react-ui';
import { toast, toastSuccess } from '@novasamatech/tr-ui';
import { AlertCircle } from 'lucide-react';
import { ResultAsync } from 'neverthrow';
import { type RefObject, useEffect, useState } from 'react';
import * as v from 'valibot';

import { useConfirmation } from '@/shared/components';
import { useLooseRef } from '@/shared/hooks';
import { useTranslation } from '@/shared/translation';
import { type HexString } from '@/shared/types';
import { toError } from '@/shared/utils';
import { accountId, accountService } from '@/domains/network';
import { dotNsService, productAccountService } from '@/domains/product';
import { type CreateTransactionResult, type SigningResult } from '../types';
import { CreateTransactionModal } from '../ui/CreateTransactionModal';
import { SignPayloadModal } from '../ui/SignPayloadModal';
import { SignRawModal } from '../ui/SignRawModal';
import { SigningErrorDetailsDialog } from '../ui/SigningErrorDetailsDialog';
import { type SigningErrorState, buildSigningErrorState } from '../ui/signingErrorDetail';

import { pappSsoQueue } from './_helpers';

const hostOkFromModalResult = (result: SigningResult) => {
  const st = result.signedTransaction;
  return {
    signature: result.signature,
    signedTransaction: st ? (typeof st === 'string' ? st : toHex(st)) : undefined,
  };
};

let signingCounter = 0;
const nextSigningId = () => `sign#${++signingCounter}`;
const sLog = (id: string, stage: string, extra?: Record<string, unknown>) => {
  console.info(`[Signing][${id}] ${stage}`, extra ?? '');
};

export function useSigning(container: Container, identifier: string, contextGenesisHashRef: RefObject<HexString | null>) {
  const { t } = useTranslation();
  const confirm = useConfirmation();
  const { session } = useSession();
  const sessionRef = useLooseRef(session);

  const [signingErrorState, setSigningErrorState] = useState<SigningErrorState | null>(null);

  useEffect(() => {
    if (!container) return;

    const showSigningErrorToast = (error: unknown) => {
      if (error instanceof SigningErr.Rejected || error instanceof CreateTransactionErr.Rejected) {
        return;
      }

      const nextSigningErrorState = buildSigningErrorState(error);
      const description =
        nextSigningErrorState.summaryLine.length > 0 ? nextSigningErrorState.summaryLine : t('feature.browser.signingFailedBody');

      toast.error(t('feature.browser.signingFailedTitle'), {
        action: {
          label: t('feature.browser.signingErrorToastDetails'),
          onClick: () => {
            setSigningErrorState(nextSigningErrorState);
          },
        },
        closeButton: true,
        description,
        duration: 10_000,
        icon: <AlertCircle aria-hidden className="size-6 shrink-0 text-fg-error" strokeWidth={1.5} />,
      });
    };

    const abortController = new AbortController();

    // Pass through SigningErr from the task; wrap anything else (e.g. abort).
    const queueSigning = <X,>(task: () => ResultAsync<X, unknown>): ResultAsync<X, any> =>
      ResultAsync.fromPromise(pappSsoQueue.call(task, { signal: abortController.signal }), err =>
        err instanceof SigningErr ? err : new SigningErr.Unknown({ reason: toError(err).message }),
      ).andThen(r => r);

    const cleanupSignPayload = container.handleSignPayload(({ account, payload }, { ok, err }) => {
      const id = nextSigningId();
      sLog(id, 'handleSignPayload invoked', { identifier, account, genesisHash: payload.genesisHash });
      const activeSession = sessionRef();
      if (!activeSession) {
        sLog(id, 'rejected — no active session');
        return err(new SigningErr.Rejected());
      }
      if (account[0] !== identifier || !dotNsService.isProductIdentifier(account[0])) {
        sLog(id, 'permission denied', { expected: identifier, got: account[0] });
        return err(new SigningErr.PermissionDenied());
      }

      sLog(id, 'queued in signing pool');
      return queueSigning(() => {
        sLog(id, 'opening SignPayload modal');
        const response = confirm<SigningResult>('signPayload', ({ resolve, reject }) => {
          return (
            <SignPayloadModal
              session={activeSession}
              payload={payload}
              productAccountId={account}
              productIdentifier={identifier}
              flowId={id}
              onResult={resolve}
              onCancel={reject}
            />
          );
        });

        return ResultAsync.fromPromise(response, e => e)
          .andTee(() => {
            sLog(id, 'modal resolved with signature');
            toastSuccess({ title: t('feature.browser.transactionSigned') });
          })
          .andThen(result => {
            sLog(id, 'sending ok() to product');
            try {
              const r = ok(hostOkFromModalResult(result));
              sLog(id, 'ok() sent successfully');
              return r;
            } catch (e) {
              sLog(id, 'ok() THREW (transport likely disposed)', { error: e instanceof Error ? e.message : String(e) });
              throw e;
            }
          })
          .orTee(error => {
            sLog(id, 'flow failed', { error: error instanceof Error ? error.message : String(error) });
            showSigningErrorToast(error);
          });
      });
    });

    const cleanupCreateTransaction = container.handleCreateTransaction((params, { ok, err }) => {
      const { signer, genesisHash, callData, extensions, txExtVersion } = params;
      const id = nextSigningId();
      sLog(id, 'handleCreateTransaction invoked', { identifier, signer, genesisHash: toHex(genesisHash) });
      const activeSession = sessionRef();
      if (!activeSession) {
        sLog(id, 'rejected — no active session');
        return err(new CreateTransactionErr.Rejected());
      }
      if (signer[0] !== identifier || !dotNsService.isProductIdentifier(signer[0])) {
        sLog(id, 'permission denied', { expected: identifier, got: signer[0] });
        return err(new CreateTransactionErr.PermissionDenied());
      }

      sLog(id, 'queued in signing pool');
      return queueSigning(() => {
        sLog(id, 'opening CreateTransaction modal');
        const response = confirm<CreateTransactionResult>('createTransaction', ({ resolve, reject }) => {
          return (
            <CreateTransactionModal
              session={activeSession}
              transaction={{ genesisHash, callData, extensions, txExtVersion }}
              productAccountId={signer}
              productIdentifier={identifier}
              flowId={id}
              onResult={resolve}
              onCancel={reject}
            />
          );
        });

        return ResultAsync.fromPromise(response, e => e)
          .andTee(() => {
            sLog(id, 'modal resolved with signed transaction');
            toastSuccess({ title: t('feature.browser.transactionSigned') });
          })
          .andThen(result => {
            sLog(id, 'sending ok() to product');
            try {
              const r = ok(result.signedTransaction);
              sLog(id, 'ok() sent successfully');
              return r;
            } catch (e) {
              sLog(id, 'ok() THREW (transport likely disposed)', { error: e instanceof Error ? e.message : String(e) });
              throw e;
            }
          })
          .orTee(error => {
            sLog(id, 'flow failed', { error: error instanceof Error ? error.message : String(error) });
            showSigningErrorToast(error);
          });
      });
    });

    const cleanupSignRaw = container.handleSignRaw(({ account, payload }, { ok, err }) => {
      const id = nextSigningId();
      sLog(id, 'handleSignRaw invoked', { identifier, account });
      const activeSession = sessionRef();
      if (!activeSession) {
        sLog(id, 'rejected — no active session');
        return err(new SigningErr.Rejected());
      }
      if (account[0] !== identifier || !dotNsService.isProductIdentifier(account[0])) {
        sLog(id, 'permission denied', { expected: identifier, got: account[0] });
        return err(new SigningErr.PermissionDenied());
      }

      sLog(id, 'queued in signing pool');
      return queueSigning(() => {
        sLog(id, 'opening SignRaw modal');
        const response = confirm<SigningResult>('signRaw', ({ resolve, reject }) => {
          return (
            <SignRawModal
              session={activeSession}
              payload={payload}
              productAccountId={account}
              productIdentifier={identifier}
              contextGenesisHash={contextGenesisHashRef.current}
              flowId={id}
              onResult={resolve}
              onCancel={reject}
            />
          );
        });

        return ResultAsync.fromPromise(response, e => e)
          .andTee(() => {
            sLog(id, 'modal resolved with signature');
            toastSuccess({ title: t('feature.browser.messageSigned') });
          })
          .andThen(result => {
            sLog(id, 'sending ok() to product');
            try {
              const r = ok(hostOkFromModalResult(result));
              sLog(id, 'ok() sent successfully');
              return r;
            } catch (e) {
              sLog(id, 'ok() THREW (transport likely disposed)', { error: e instanceof Error ? e.message : String(e) });
              throw e;
            }
          })
          .orTee(error => {
            sLog(id, 'flow failed', { error: error instanceof Error ? error.message : String(error) });
            showSigningErrorToast(error);
          });
      });
    });

    // TODO remove implementation, it should use real legacy accounts (that are not implemented)
    const cleanupSignPayloadWithLegacyAccount = container.handleSignPayloadWithLegacyAccount(
      ({ signer, payload }, { ok, err }) => {
        const id = nextSigningId();
        sLog(id, 'handleSignPayloadWithLegacyAccount invoked', { identifier, signer, genesisHash: payload.genesisHash });
        const activeSession = sessionRef();
        if (!activeSession) {
          sLog(id, 'rejected — no active session');
          return err(new SigningErr.Rejected());
        }

        const possiblePublicKey = productAccountService.deriveProductPublicKey(activeSession.rootAccountId, identifier, 0);
        const possibleAddress = accountService.toAddress(v.parse(accountId, toHex(possiblePublicKey))).value;
        if (possibleAddress !== signer) {
          return err(new SigningErr.Unknown({ reason: "Account can't be derived from product account id" }));
        }

        sLog(id, 'queued in signing pool');
        return queueSigning(() => {
          sLog(id, 'opening SignPayloadWithLegacyAccount modal');
          const response = confirm<SigningResult>('signPayloadWithLegacyAccount', ({ resolve, reject }) => {
            return (
              <SignPayloadModal
                session={activeSession}
                payload={payload}
                productAccountId={[identifier, 0]}
                productIdentifier={identifier}
                flowId={id}
                onResult={resolve}
                onCancel={reject}
              />
            );
          });

          return (
            ResultAsync
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              .fromPromise(response, e => e as never)
              .andTee(() => {
                sLog(id, 'modal resolved with signature');
                toastSuccess({ title: t('feature.browser.transactionSigned') });
              })
              .andThen(result => {
                sLog(id, 'sending ok() to product');
                try {
                  const r = ok(hostOkFromModalResult(result));
                  sLog(id, 'ok() sent successfully');
                  return r;
                } catch (e) {
                  sLog(id, 'ok() THREW (transport likely disposed)', { error: e instanceof Error ? e.message : String(e) });
                  throw e;
                }
              })
              .orTee((error: unknown) => {
                sLog(id, 'flow failed', { error: error instanceof Error ? error.message : String(error) });
                showSigningErrorToast(error);
              })
          );
        });
      },
    );

    // TODO remove implementation, it should use real legacy accounts (that are not implemented)
    const cleanupSignRawWithLegacyAccount = container.handleSignRawWithLegacyAccount(({ signer, payload }, { ok, err }) => {
      const id = nextSigningId();
      sLog(id, 'handleSignRawWithLegacyAccount invoked', { identifier, signer });
      const activeSession = sessionRef();
      if (!activeSession) {
        sLog(id, 'rejected — no active session');
        return err(new SigningErr.Rejected());
      }

      const possiblePublicKey = productAccountService.deriveProductPublicKey(activeSession.rootAccountId, identifier, 0);
      const possibleAddress = accountService.toAddress(v.parse(accountId, toHex(possiblePublicKey))).value;
      if (possibleAddress !== signer) {
        return err(new SigningErr.Unknown({ reason: "Account can't be derived from product account id" }));
      }

      sLog(id, 'queued in signing pool');
      return queueSigning(() => {
        sLog(id, 'opening SignRawWithLegacyAccount modal');
        const response = confirm<SigningResult>('signRawWithLegacyAccount', ({ resolve, reject }) => {
          return (
            <SignRawModal
              session={activeSession}
              payload={payload}
              productAccountId={[identifier, 0]}
              productIdentifier={identifier}
              contextGenesisHash={contextGenesisHashRef.current}
              flowId={id}
              onResult={resolve}
              onCancel={reject}
            />
          );
        });

        return ResultAsync.fromPromise(response, e => e)
          .andTee(() => {
            sLog(id, 'modal resolved with signature');
            toastSuccess({ title: t('feature.browser.messageSigned') });
          })
          .andThen(result => {
            sLog(id, 'sending ok() to product');
            try {
              const r = ok(hostOkFromModalResult(result));
              sLog(id, 'ok() sent successfully');
              return r;
            } catch (e) {
              sLog(id, 'ok() THREW (transport likely disposed)', { error: e instanceof Error ? e.message : String(e) });
              throw e;
            }
          })
          .orTee(error => {
            sLog(id, 'flow failed', { error: error instanceof Error ? error.message : String(error) });
            showSigningErrorToast(error);
          });
      });
    });

    return () => {
      cleanupSignPayload();
      cleanupCreateTransaction();
      cleanupSignRaw();
      cleanupSignPayloadWithLegacyAccount();
      cleanupSignRawWithLegacyAccount();
      abortController.abort();
    };
  }, [identifier, container, t, confirm, contextGenesisHashRef, sessionRef]);

  return <SigningErrorDetailsDialog signingErrorState={signingErrorState} onClose={() => setSigningErrorState(null)} />;
}
