import {
  type AllocatableResource,
  type ChatMessageContent,
  type DerivationIndex,
  type HostSignPayloadData,
  type ProductAccountId,
  type ProductProofContext,
  type RawPayload,
} from '@parity/truapi';
import {
  type AccountAccessReview,
  type AccountAliasReview,
  type CreateProofReview,
  type CreateTransactionReview,
  type IdentityDisclosureReview,
  type ProductSubtreeReview,
  type ResourceAllocationReview,
  type SignPayloadReview,
  type SignRawReview,
  type SignVrfReview,
  type StatementStoreProductSignReview,
  type UserConfirmationReview,
} from '@parity/truapi-host';
import { fromHex, toHex } from 'polkadot-api/utils';

import { type MessageContent } from '@/domains/chat';

/**
 * Which confirmation surface a core review opens, and the payload it needs.
 *
 * The core reviews the action and asks one question — `confirmUserAction` — over a
 * union of review variants. This maps that union onto the host's modals so the UI
 * layer switches on `target` instead of re-reading the core's shape.
 *
 * One `target` per surface, so `target` discriminates `review`: a modal receives the
 * exact review type it renders and cannot be handed a sibling's payload. The five
 * permission-shaped requests are listed individually for that reason, even though they
 * share a layout.
 *
 * The `legacyAccount` flag is carried rather than folded into `target` because the
 * legacy and product variants share a modal shape and differ only in which account
 * signs.
 */
export type ReviewModalProps =
  | { target: 'signPayload'; legacyAccount: boolean; review: SignPayloadReview }
  | { target: 'signRaw'; legacyAccount: boolean; review: SignRawReview }
  | { target: 'createTransaction'; legacyAccount: boolean; review: CreateTransactionReview }
  | { target: 'signVrf'; review: SignVrfReview }
  | { target: 'allowance'; review: ResourceAllocationReview }
  | { target: 'statementSign'; review: StatementStoreProductSignReview }
  | { target: 'createProof'; review: CreateProofReview }
  | { target: 'identityDisclosure'; review: IdentityDisclosureReview }
  | { target: 'accountAccess'; review: AccountAccessReview }
  | { target: 'accountAlias'; review: AccountAliasReview }
  | { target: 'productSubtree'; review: ProductSubtreeReview };

/**
 * `null` for a review the host has no surface for, which the caller answers as a
 * rejection.
 */
function toModalProps(review: UserConfirmationReview): ReviewModalProps | null {
  switch (review.tag) {
    case 'SignPayload':
      return { target: 'signPayload', legacyAccount: review.value.tag === 'LegacyAccount', review: review.value };

    case 'SignRaw':
      return { target: 'signRaw', legacyAccount: review.value.tag === 'LegacyAccount', review: review.value };

    case 'CreateTransaction':
      return { target: 'createTransaction', legacyAccount: review.value.tag === 'LegacyAccount', review: review.value };

    case 'SignVrf':
      return { target: 'signVrf', review: review.value };

    case 'ResourceAllocation':
      return { target: 'allowance', review: review.value };

    case 'StatementStoreProductSign':
      return { target: 'statementSign', review: review.value };

    case 'CreateProof':
      return { target: 'createProof', review: review.value };

    case 'IdentityDisclosure':
      return { target: 'identityDisclosure', review: review.value };

    case 'AccountAccess':
      return { target: 'accountAccess', review: review.value };

    case 'AccountAlias':
      return { target: 'accountAlias', review: review.value };

    case 'ProductSubtree':
      return { target: 'productSubtree', review: review.value };

    // TODO(truapi): add a drain review modal when one is designed; until then a product
    // cannot move items out of a purse it does not own.
    case 'NftPurseDrain':
      return null;
  }
}

/**
 * The core's chat content union, in the domain's vocabulary.
 *
 * Five of the core's seven variants have a domain counterpart; the rest degrade to
 * a text placeholder rather than being dropped, so a product that sends one still
 * produces a visible message.
 */
function toChatMessageContent(payload: ChatMessageContent, alt?: string): MessageContent {
  switch (payload.tag) {
    case 'Text':
      return { type: 'text', text: payload.value.text };
    case 'RichText':
      return { type: 'richText', text: payload.value.text };
    case 'Reaction':
      return { type: 'reacted', messageId: payload.value.messageId, emoji: payload.value.emoji };
    case 'ReactionRemoved':
      return { type: 'reactionRemoved', messageId: payload.value.messageId, emoji: payload.value.emoji };
    case 'Custom':
      return {
        type: 'custom',
        messageType: payload.value.messageType,
        payload: fromHex(payload.value.payload),
        ...(alt === undefined ? {} : { alt }),
      };
    default:
      return { type: 'text', text: 'Unsupported message format' };
  }
}

/** The call bytes and the chain they belong to, for the reviews that carry them. */
export type CallSource = { callData: string; genesisHash: string };

/**
 * The call source of a review, or `null` for a review that has none.
 *
 * Only `createTransaction` carries one: a sign-payload review carries an
 * already-built extrinsic payload rather than a bare call, so there is nothing to
 * decode against a pallet index.
 */
function callSourceOf(props: ReviewModalProps): CallSource | null {
  if (props.target !== 'createTransaction') return null;

  const { value } = props.review;

  return 'callData' in value && 'genesisHash' in value ? { callData: value.callData, genesisHash: value.genesisHash } : null;
}

/** `my-product.dot//3` — how a product account is written wherever one is shown. */
function formatProductAccount(account: ProductAccountId): string {
  return `${account.dotNsIdentifier}//${describeDerivationIndex(account.derivationIndex)}`;
}

/** `my-product.dot/#3` — a proof or alias context, product plus selector. */
function formatProofContext(context: ProductProofContext): string {
  return `${context.productId}/${describeDerivationIndex(context.suffix)}`;
}

/** The text a raw-signing review is actually asking the user to sign. */
function rawPayloadText(payload: RawPayload): string {
  return payload.tag === 'Payload' ? payload.value.payload : payload.value.bytes;
}

/** Hex for the transcript items, statement payloads, and labels shown verbatim. */
function formatTranscriptBytes(value: string | Uint8Array): string {
  return typeof value === 'string' ? value : toHex(value);
}

/**
 * The call bytes inside an already-built sign-payload request.
 *
 * `method` is the field's name on the wire — it carries SCALE-encoded call data, the
 * same bytes `callData` names elsewhere — so it is renamed here rather than at every
 * call site.
 */
function payloadCallSource(payload: HostSignPayloadData): CallSource {
  return { callData: payload.method, genesisHash: payload.genesisHash };
}

/**
 * The message key warning what a batch call does when one of its calls fails, or `null`
 * for a call that is not a batch.
 *
 * `utility.batch` stops at the first failure and keeps what already ran, which is the
 * one batch outcome a user is likely to be surprised by.
 */
function batchBehaviorKey(pallet: string, method: string): string | null {
  switch (`${normalizeCallSegment(pallet)}.${normalizeCallSegment(method)}`) {
    case 'utility.batchall':
      return 'feature.browser.batchBehavior.revertOnError';
    case 'utility.batch':
      return 'feature.browser.batchBehavior.executeUntilError';
    case 'utility.forcebatch':
      return 'feature.browser.batchBehavior.ignoreErrors';
    default:
      return null;
  }
}

function normalizeCallSegment(segment: string): string {
  return segment.replace(/[_-]/g, '').toLowerCase();
}

/**
 * `staking.bond_extra` → `Staking Bond Extra`.
 *
 * Pallet and call names arrive in whatever case the runtime declares, so both
 * `bond_extra` and `bondExtra` have to read the same in a title a user is about to
 * approve.
 */
function humanizeCallSegment(segment: string): string {
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * A decoded call as one title: `Balances Transfer Keep Alive`.
 *
 * Composed here rather than in JSX because both halves come from chain metadata and
 * are not translatable — joining them in the component would put an untranslated
 * separator in the tree.
 */
function formatCallTitle(pallet: string, method: string): string {
  return `${humanizeCallSegment(pallet)} ${humanizeCallSegment(method)}`.trim();
}

/**
 * Call arguments as readable JSON.
 *
 * `bigint` is stringified rather than dropped — `JSON.stringify` throws on it, and a
 * balance silently missing from a transaction the user is approving is the worst
 * possible omission.
 */
function stringifyCallArguments(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? item.toString() : item), 2) ?? '{}';
}

/** One requested grant, as a message key the dialog translates. */
export type ResourceGrant = {
  key: string;
  values?: Record<string, string>;
};

/**
 * The resources an allocation review asks for.
 *
 * Every variant gets its own key rather than a humanized tag, because these are the
 * grants the user is agreeing to and the differences between them are not
 * self-evident from a name. `AutoSigning` in particular is not one more storage
 * slot: it lets the product sign without asking again, so it says so.
 *
 * Keys, not copy: this is user-facing text on the dialog that grants a product the
 * right to sign, so it goes through `react-intl` like the rest of the dialog
 * (`style.md` § i18n).
 *
 * No `default` arm on purpose: a variant added upstream fails to compile here rather
 * than reaching a user as a silently unlisted grant in a list they are approving.
 */
function describeResources(resources: AllocatableResource[]): ResourceGrant[] {
  return resources.map((resource): ResourceGrant => {
    switch (resource.tag) {
      case 'StatementStoreAllowance':
        return { key: 'feature.productRuntime.review.resource.statementStore' };
      case 'BulletinAllowance':
        return { key: 'feature.productRuntime.review.resource.bulletin' };
      case 'SmartContractAllowance':
        return {
          key: 'feature.productRuntime.review.resource.smartContract',
          values: { account: describeDerivationIndex(resource.value) },
        };
      case 'AutoSigning':
        return { key: 'feature.productRuntime.review.resource.autoSigning' };
    }
  });
}

// The derivation index as the chain addresses it — an index or a named path. Not
// translated: it identifies an account, it does not describe one.
function describeDerivationIndex(index: DerivationIndex): string {
  return index.tag === 'Index' ? `#${index.value.toString()}` : index.value;
}

export const productRuntimeService = {
  toModalProps,
  callSourceOf,
  payloadCallSource,
  formatProductAccount,
  formatProofContext,
  formatTranscriptBytes,
  rawPayloadText,
  batchBehaviorKey,
  toChatMessageContent,
  humanizeCallSegment,
  formatCallTitle,
  stringifyCallArguments,
  describeResources,
};
