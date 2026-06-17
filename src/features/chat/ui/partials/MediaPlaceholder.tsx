import MediaIcon from '@/shared/assets/images/photo.svg?jsx';
import { BlurhashCanvas } from '@/shared/components';
import { TEST_IDS } from '@/shared/test-ids';
import { useTranslation } from '@/shared/translation';
import { cnTw } from '@/shared/utils';

type Props = {
  isMe: boolean;
  // Wolt-spec blurhash for image/video attachments that carry a thumbnail.
  // Painted as a blurred preview behind the card — it travels inline in the
  // statement, never over HOP, so showing it claims nothing.
  blurhash?: string;
};

// Desktop cannot obtain chat media: claiming it over HOP would burn the
// one-shot entry the mobile recipient needs. We render this card instead of
// downloading anything — see docs/_plans/chat-media-placeholder-plan.md. When a
// blurhash is present we paint it (blurred) behind the card; the icon + text
// stay overlaid on a scrim. See docs/_plans/chat-media-blurhash-plan.md.
export const MediaPlaceholder = ({ isMe, blurhash }: Props) => {
  const { t } = useTranslation();

  // A blurhash card reads as dark (blurred preview + scrim), so the foreground
  // takes the same "on-dark" tone as an isMe bubble: light text and a light
  // chip with a dark icon.
  const isDarkCard = isMe || Boolean(blurhash);

  return (
    <div
      data-testid={TEST_IDS.chatMediaPlaceholder}
      className={cnTw(
        'relative flex w-60 max-w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl px-6 py-8 text-center',
        isDarkCard ? 'bg-bg-surface-nested-inverted' : 'bg-bg-surface-container',
      )}
    >
      {blurhash ? (
        <div data-testid={TEST_IDS.chatMediaPlaceholderBlurhash} className="absolute inset-0" aria-hidden>
          <BlurhashCanvas hash={blurhash} className="size-full object-cover" />
          {/* Scrim keeps the icon + text legible over an arbitrarily bright preview. */}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ) : null}
      <span
        className={cnTw(
          'relative flex size-12 items-center justify-center rounded-xl',
          // Chip tone is inverted vs the card so the icon never blends in
          // (no white-on-white / black-on-black).
          isDarkCard ? 'bg-bg-surface-container' : 'bg-bg-surface-container-inverted',
        )}
      >
        <MediaIcon className={cnTw('size-6', isDarkCard ? 'text-fg-tertiary' : 'text-fg-tertiary-inverted')} />
      </span>
      <span className={cnTw('relative text-sm leading-5', isDarkCard ? 'text-fg-secondary-inverted' : 'text-fg-secondary')}>
        {t('feature.chat.mediaMobileOnly')}
      </span>
    </div>
  );
};
