import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { type QueryRecipient } from '@/domains/input-routing';
import { type DraftAttachment } from '../types';

import { ProductIdentity } from './ProductIdentity';

type Props = {
  attachment: DraftAttachment;
  recipients: QueryRecipient[];
  onPick: (productId: string) => void;
};

/**
 * The user names the one product that receives an attachment.
 *
 * This is the only input whose recipient the user directs rather than the host,
 * and it is not a UI preference: an attachment carries its contents, so
 * broadcasting to find a taker would hand the bytes to every declaring worker.
 * Nothing moves until a name is picked here.
 */
export const AttachmentPicker = ({ attachment, recipients, onPick }: Props) => {
  const { t } = useTranslation();

  return (
    <div data-testid={TEST_IDS.inputModalityPicker} className="flex flex-col gap-1 rounded-2xl bg-bg-surface-nested p-2">
      <span className="px-1 text-xs text-fg-secondary">
        {t('feature.inputModality.pickerPrompt', { fileName: attachment.routed.data.fileName })}
      </span>

      {recipients.length === 0 ? (
        // No fallback: the host does not open the attachment itself, and no
        // bytes leave the host.
        <span className="px-1 py-2 text-sm text-fg-secondary">{t('feature.inputModality.pickerEmpty')}</span>
      ) : (
        recipients.map(recipient => (
          <button
            key={recipient.productId}
            type="button"
            data-testid={TEST_IDS.inputModalityPickerOption}
            className="flex h-control items-center gap-2 rounded-xl px-2 text-left transition-colors hover:bg-bg-selection-container-hover"
            onClick={() => onPick(recipient.productId)}
          >
            <ProductIdentity prominent productId={recipient.productId} />
          </button>
        ))
      )}
    </div>
  );
};
