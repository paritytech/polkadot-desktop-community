import { type PermissionDecision, type ProductContext, type UserConfirmationReview } from '@parity/truapi-host';
import { useMemo, useRef } from 'react';

import { useConfirmation } from '@/shared/components';
import { useLooseRef } from '@/shared/hooks';
import { grantTransientDevicePermission } from '@/domains/product';
import { RemotePermissionRequestDialog } from '@/widgets/Permission';
import { type HostPrompts } from '../createHostCallbacks';
import { productRuntimeService } from '../service';
import { ProductReviewDialog } from '../ui/ProductReviewDialog';

/**
 * The callbacks that need a user in the loop.
 *
 * Every one fails closed: a prompt torn down without an answer — the component
 * unmounting, the entry being disposed — resolves to a denial, never an approval.
 *
 * Both permission callbacks answer with a lifetime the core then owns: under the core's
 * contract the core persists an `AllowAlways` itself. The one grant written here is the
 * session-scoped one a device `AllowOnce` needs at the native gate.
 */
export function useHostPrompts(): HostPrompts {
  const confirm = useConfirmation();
  const confirmRef = useLooseRef(confirm);
  const nextReviewId = useRef(0);

  return useMemo<HostPrompts>(() => {
    const ask = async (review: UserConfirmationReview): Promise<boolean> => {
      // A distinct id per review: `useConfirmation` keys entries by id and rejects
      // the previous holder of a reused one, which would resolve a live prompt as
      // denied while the user was still looking at it.
      const id = `truapi-review:${nextReviewId.current++}`;
      const props = productRuntimeService.toModalProps(review);
      if (!props) return false;

      return confirmRef()<boolean>(id, ({ resolve }) => <ProductReviewDialog props={props} onDecide={resolve} />).catch(
        () => false,
      );
    };

    // `capability` is the wire value, which is already the copy key the shared dialog
    // looks up — `HostDevicePermissionRequest` is a bare string ("Camera", "NFC") and
    // a `RemotePermission`'s tag reads the same way ("Remote", "ChainSubmit").
    //
    // `values` carries the domains a `Remote` request names. The dialog renders its
    // domain block whenever `permission === 'Remote'`, under copy that reads "Used to
    // make requests to the following domains" — passing null there would print that
    // sentence above an empty box.
    const askPermission = (
      product: ProductContext,
      capability: string,
      values: string[] | null = null,
    ): Promise<PermissionDecision> => {
      const id = `truapi-permission:${nextReviewId.current++}`;

      return confirmRef()<PermissionDecision>(id, ({ resolve }) => (
        <RemotePermissionRequestDialog
          isOpen
          productId={product.productId}
          permission={capability}
          values={values}
          onAllowAlways={() => resolve('AllowAlways')}
          onAllowOnce={() => resolve('AllowOnce')}
          onDeny={() => resolve('Deny')}
          onDismiss={() => resolve('Deny')}
        />
      )).catch((): PermissionDecision => 'Deny');
    };

    return {
      userConfirmation: {
        confirmUserAction: ask,
        // No lifetime is offered for an identity or account disclosure — the review
        // surface asks about one action — so an approval is always one-shot.
        confirmPermission: async review => ((await ask(review)) ? 'AllowOnce' : 'Deny'),
      },

      permissions: {
        devicePermission: async (product, request) => {
          const decision = await askPermission(product, request);

          // Camera, microphone and location also pass Electron's native gate, which the
          // core's answer never reaches. A one-shot grant is recorded there before the
          // product hears `AllowOnce`, or it would be told yes and then be refused.
          if (decision === 'AllowOnce') {
            grantTransientDevicePermission({
              productId: product.productId,
              permission: request,
              executionKind: product.executionKind,
            });
          }

          return decision;
        },
        remotePermission: (product, request) =>
          askPermission(
            product,
            request.permission.tag,
            request.permission.tag === 'Remote' ? request.permission.value.domains : null,
          ),
      },
    };
  }, []);
}
