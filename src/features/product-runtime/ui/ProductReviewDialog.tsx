import { type ReviewModalProps } from '../service';

import { AccountAccessModal } from './requests/AccountAccessModal';
import { AliasPermissionModal } from './requests/AliasPermissionModal';
import { AllocationRequestModal } from './requests/AllocationRequestModal';
import { CreateTransactionModal } from './requests/CreateTransactionModal';
import { IdentityDisclosureModal } from './requests/IdentityDisclosureModal';
import { ProductSubtreeModal } from './requests/ProductSubtreeModal';
import { ProofPermissionModal } from './requests/ProofPermissionModal';
import { SignPayloadModal } from './requests/SignPayloadModal';
import { SignRawModal } from './requests/SignRawModal';
import { SignVrfModal } from './requests/SignVrfModal';
import { StatementSignModal } from './requests/StatementSignModal';

type Props = {
  props: ReviewModalProps;
  onDecide: (approved: boolean) => void;
  /**
   * The "no answer" path for `confirmPermission` reviews (identity disclosure, account
   * access): Esc / X leaves the core unanswered instead of persisting a refusal. When
   * absent, a dismissal is `onDecide(false)`.
   */
  onDismiss?: VoidFunction;
};

/**
 * Routes one core review to the modal that knows how to present it.
 *
 * A router and nothing else: every kind of request the core can raise has a surface
 * built for it, because "what am I approving" is a different question for a transaction,
 * a VRF transcript and a standing allowance, and one dialog that renders all three is one
 * that answers none of them.
 *
 * No `default` arm — `ReviewModalProps` is a closed union, so a variant added upstream
 * fails to compile here rather than reaching a user as a blank dialog.
 */
export const ProductReviewDialog = ({ props, onDecide, onDismiss }: Props) => {
  switch (props.target) {
    case 'createTransaction':
      return <CreateTransactionModal review={props.review} onDecide={onDecide} />;

    case 'signPayload':
      return <SignPayloadModal review={props.review} onDecide={onDecide} />;

    case 'signRaw':
      return <SignRawModal review={props.review} onDecide={onDecide} />;

    case 'signVrf':
      return <SignVrfModal review={props.review} onDecide={onDecide} />;

    case 'allowance':
      return <AllocationRequestModal review={props.review} onDecide={onDecide} />;

    case 'statementSign':
      return <StatementSignModal review={props.review} onDecide={onDecide} />;

    case 'createProof':
      return <ProofPermissionModal review={props.review} onDecide={onDecide} />;

    case 'accountAlias':
      return <AliasPermissionModal review={props.review} onDecide={onDecide} />;

    case 'identityDisclosure':
      return <IdentityDisclosureModal review={props.review} onDecide={onDecide} onDismiss={onDismiss} />;

    case 'accountAccess':
      return <AccountAccessModal review={props.review} onDecide={onDecide} onDismiss={onDismiss} />;

    case 'productSubtree':
      return <ProductSubtreeModal review={props.review} onDecide={onDecide} />;
  }
};
